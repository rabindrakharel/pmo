# Universal Field Detector - Complete Column Pattern Analysis
## Comprehensive Database Schema Analysis & Field Detection Guide

**Analysis Date:** 2025-11-12  
**Codebase:** Huron Home Services PMO  
**Status:** 802 unique columns analyzed across 47 tables (49 DDL files)

---

## Executive Summary

This comprehensive analysis reveals **12 distinct field naming patterns** used throughout the database, with detailed detection logic for automatic field capability determination. The system processes **47 tables** with **802 unique columns**, organizing them into semantic categories for DRY-first field handling.

### Key Statistics
- **Total DDL Files:** 49
- **Total Database Tables:** 47  
- **Unique Column Names:** 802
- **Named Patterns:** 12 major categories
- **Pattern Coverage:** ~316 columns (39%) directly match patterns
- **Remaining Columns:** ~486 (61%) general-purpose fields requiring context

---

## Part 1: Column Pattern Distribution

### Pattern Summary Table

| Pattern | Count | Data Types | Key Examples | Current Detection |
|---------|-------|------------|--------------|-------------------|
| **Timestamps** | 30 | `timestamptz`, `TIMESTAMP` | `created_ts`, `updated_ts`, `from_ts`, `to_ts` | ✅ Regex: `_(ts\|at\|timestamp)$` |
| **Dates** | 47 | `date`, `DATE` | `planned_start_date`, `hire_date`, `created_date` | ✅ Regex: `_date$` |
| **Foreign Keys** | 59 | `uuid`, `UUID`, `text`, `int4` | `project_id`, `employee_id`, `manager_employee_id` | ✅ Regex: `_id$` |
| **Currency/Amounts** | 16 | `decimal(15,2)`, `numeric(10,2)` | `budget_allocated_amt`, `labor_cost_amt` | ✅ Regex: `(_amt\|_price\|_cost\|_rate)$` |
| **Booleans/Flags** | 39 | `boolean`, `BOOLEAN` | `active_flag`, `remote_work_eligible_flag` | ✅ Regex: `^(is_\|has_\|_flag).*\|.*_flag$` |
| **Counts/Quantities** | 29 | `integer`, `numeric(10,2)` | `attachment_count`, `labor_hours`, `reorder_qty` | ✅ Regex: `(_count\|_qty\|_hours\|_minutes\|_seconds)$` |
| **Percentages** | 6 | `decimal(5,2)`, `numeric(5,2)` | `discount_pct`, `margin_percent` | ✅ Regex: `(_pct\|_percent)$` |
| **Datalabels** | 19 | `text` | `dl__project_stage`, `dl__task_priority` | ✅ Regex: `^dl__` |
| **Standard Fields** | 5 | `text`, `varchar` | `name`, `code`, `descr`, `description` | ✅ Exact match |
| **JSONB/Metadata** | 38 | `jsonb`, `JSONB` | `metadata`, `submission_data`, `workflow_graph` | ✅ Data type check |
| **Arrays** | 28 | `uuid[]`, `text[]`, `varchar[]` | `tags`, `skills_service_categories`, `email_subscribers` | ✅ Data type check: contains `[]` |
| **Other/Context-Dependent** | 486 | Varied | Mixed domain fields | ⚠️ Requires context |

---

## Part 2: Detailed Pattern Specifications

### 1. TIMESTAMPS (30 columns)

**Purpose:** Track point-in-time events and state changes  
**Pattern:** Suffix `_ts`, `_at`, or `_timestamp`  
**Data Types:** `timestamptz`, `TIMESTAMP`

#### Examples
```
created_ts              (46 tables)     - Record creation timestamp
updated_ts              (43 tables)     - Last modification timestamp
from_ts                 (29 tables)     - Range start timestamp
to_ts                   (29 tables)     - Range end timestamp
last_login_ts           (2 tables)      - Last user login
completed_ts            (3 tables)      - Task/workflow completion
approved_ts             (1 table)       - Approval timestamp
published_ts            (1 table)       - Publishing timestamp
```

#### Current Detection (Frontend)
```typescript
// apps/web/src/lib/data_transform_render.tsx (line 424)
FIELD_PATTERNS.date: /_(date|ts)$|^date_/i
```

#### Rendering Logic
- **Format:** Relative time "3 days ago", "20 seconds ago"
- **Function:** `formatRelativeTime(ts)` (line 263)
- **Display:** Human-readable relative format by default
- **Timezone:** PostgreSQL `timestamptz` always stored with timezone info
- **Sorting:** Automatic (full timestamp preserved)
- **Filtering:** Range-based filters (start_date, end_date)

#### Missing Detection Improvements
- ⚠️ Not detecting `created_at`, `updated_at` pattern (found in 4 tables: f_invoice, f_shipment, f_order, f_inventory)
- ⚠️ Not detecting business-logic timestamps: `last_execution_ts`, `last_failure_ts`, `last_success_ts`
- ⚠️ System timestamps (from_ts, to_ts) mixed with business timestamps

**Recommendation:**
```typescript
// Enhanced pattern
FIELD_PATTERNS.timestamp: /_(ts|at|timestamp)$|^(created|updated|modified)_/i

// Subcategories for specific handling
const timestampTypes = {
  system: /^(created_ts|updated_ts|from_ts|to_ts)$/, // Auto-hidden
  business: /(last_|_ts)$/,  // Display with formatting
  lifecycle: /(approved|published|completed)_ts$/  // Event timestamps
};
```

---

### 2. DATES (47 columns)

**Purpose:** Store date-only values without time  
**Pattern:** Suffix `_date` or prefix `date_`  
**Data Types:** `date`, `DATE`  
**Time Component:** NONE (midnight assumed)

#### Examples
```
planned_start_date      - Project/task planned start
planned_end_date        - Project/task planned end
actual_start_date       - Actual task start
actual_end_date         - Actual task completion
hire_date               - Employee hire date
birth_date              - Employee birth date
due_date                - Invoice due date
invoice_date            - Invoice creation date
order_date              - Order creation date
shipment_date           - Shipment dispatch date
promised_delivery_date  - Expected delivery date
```

#### Current Detection (Frontend)
```typescript
// Correctly detected via: FIELD_PATTERNS.date
FIELD_PATTERNS.date: /_(date|ts)$|^date_/i
```

#### Rendering Logic
- **Format:** "Oct 28, 2024"
- **Function:** `formatFriendlyDate(date)` (line 293)
- **Editor:** HTML5 date picker `<input type="date">`
- **Database:** Stored as `YYYY-MM-DD` string
- **Range Calculation:** `calculateDateRangeProgress()` (line 350) for timelines

#### Missing Detection Improvements
- ⚠️ Inconsistent naming in single table (f_invoice has both `created_at` and `due_date`)
- ⚠️ Calculated/virtual columns: `v_current_date`, `v_due_date`, `v_start_date` (need special handling)
- ⚠️ Date pairs for ranges not linked (planned_start_date, planned_end_date should be treated as range)

**Recommendation:**
```typescript
// Detect date ranges
const dateRanges = [
  { start: 'planned_start_date', end: 'planned_end_date' },
  { start: 'actual_start_date', end: 'actual_end_date' },
  { start: 'p_start_date', end: 'p_end_date' }
];

// Handle virtual/computed dates
const virtualDatePattern = /^v_.*_date$/i;

// Timeline visualization for date ranges
function getDateRangeMetadata(startField, endField) {
  return {
    visualization: 'timeline',
    progress: true,  // Show progress bar
    icons: { start: 'Play', end: 'Stop' }
  };
}
```

---

### 3. FOREIGN KEYS (59 columns)

**Purpose:** Reference other entities  
**Pattern:** Suffix `_id`, core FK columns  
**Data Types:** `uuid`, `UUID`, `text`, `int4`

#### Examples
```
project_id              (4 tables)      - References d_project
task_id                 (1 table)       - References d_task
employee_id (base)      (N/A - implicit) - References d_employee
manager_employee_id     (4 tables)      - References d_employee (hierarchy)
office_id               (3 tables)      - References d_office
product_id              (4 tables)      - References d_product
client_id               (3 tables)      - References f_customer
order_id                (3 tables)      - References f_order
session_id              (6 tables)      - References orchestrator_session
parent_id               (3 tables)      - Hierarchical parent reference
parent_entity_id        (2 tables)      - Generic entity linkage (d_entity_id_map)
child_entity_id         (1 table)       - Generic child linkage (d_entity_id_map)
```

#### Current Detection (Frontend)
```typescript
// Detected via FIELD_PATTERNS.readonly or FIELD_PATTERNS.number
FIELD_PATTERNS.readonly: /^(id|created_ts|updated_ts|...from_ts|to_ts)$/i
FIELD_PATTERNS.number: /...|_id|/i  // Too broad!
```

#### Smart FK Handling
- **Visibility:** Column `project_id` hidden (visible=false) in tables
- **Display Name:** Auto-generated `project_name` column (visible=true) shows actual entity name
- **Foreign Key Resolution:** Entity name lookup from API response
- **Editing:** Dropdown select from entity options API
- **Linkage:** d_entity_id_map table stores actual relationships (NOT foreign key constraints)

#### Missing Detection Improvements
- ⚠️ Generic `entity_id` (text type) used for polymorphic relationships - needs special handling
- ⚠️ Hierarchical `parent_id` mixed with regular FKs
- ⚠️ Both uuid and text types for FKs - type detection needed
- ⚠️ No distinction between system FKs (user_id, tenant_id) and domain FKs (project_id)

**Recommendation:**
```typescript
// Enhanced FK detection with subcategories
const ForeignKeyPatterns = {
  // Entity references (standard business FKs)
  entityRef: /^(project|task|employee|office|product|client|order|artifact|form|wiki|service|event)_id$/i,
  
  // Polymorphic references (stored in d_entity_id_map)
  polymorphic: /(parent|child)_(entity_)?id$|entity_id$/,
  
  // System references (cross-tenant, cross-account)
  system: /^(user|session|tenant|workspace|account)_id$/i,
  
  // Hierarchy references
  hierarchy: /^parent_id$/i,
  
  // Created/Updated by (audit trail)
  audited: /(created|updated)_by_(employee)?id$/i
};

// FK type detection
function detectForeignKeyMetadata(fieldName: string) {
  return {
    entityType: extractEntityType(fieldName),        // 'project', 'employee', etc.
    isPolymorphic: fieldName === 'entity_id',
    isHierarchy: fieldName === 'parent_id',
    isAudit: /_(created|updated)_by_/.test(fieldName),
    loadOptionsFromEntity: extractEntityType(fieldName)
  };
}
```

---

### 4. CURRENCY/AMOUNTS (16 columns)

**Purpose:** Store financial values  
**Pattern:** Suffixes `_amt`, `_price`, `_cost`, `_rate`  
**Data Types:** `decimal(15,2)`, `numeric(10,2)`, `DECIMAL(5,...)`

#### Examples
```
budget_allocated_amt     (3 tables)     - Initial budget allocation
budget_spent_amt         (1 table)      - Spent from budget
labor_cost_amt           (1 table)      - Labor cost
materials_cost_amt       (1 table)      - Materials cost
total_cost_amt           (1 table)      - Total project cost
quote_total_amt          (1 table)      - Total quote price
subtotal_amt             (1 table)      - Line subtotal
quote_tax_amt            (1 table)      - Tax amount
minimum_charge_amt       (1 table)      - Service minimum charge
standard_rate_amt        (1 table)      - Service hourly rate
tax_rate                 (2 tables)     - Tax percentage (see Percentages)
exch_rate                (1 table)      - Exchange rate (see Percentages)
v_unit_price             (1 table)      - Virtual/computed field
v_unit_cost              (1 table)      - Virtual/computed field
v_tax_rate               (1 table)      - Virtual/computed field
discount_amt             (1 table)      - Discount amount
```

#### Current Detection (Frontend)
```typescript
// Via isCurrencyField() (line 335)
function isCurrencyField(key: string): boolean {
  const currencyPatterns = [
    '_amt', '_amount', '_cost', '_price', '_revenue', '_budget',
    'amount_', 'cost_', 'price_', 'revenue_', 'budget_',
    'budgeted_amt', 'forecasted_amt', 'outstanding'
  ];
  const lowerKey = key.toLowerCase();
  return currencyPatterns.some(pattern => lowerKey.includes(pattern));
}
```

#### Rendering Logic
- **Format:** `formatCurrency(value, 'CAD')` - "$1,234.56"
- **Locale:** Canadian English (en-CA)
- **Currency Symbol:** $ prefix
- **Decimals:** 2 decimal places
- **Thousands Separator:** Comma
- **Alignment:** Right-aligned in tables
- **Width:** 120px
- **Editing:** Number input with validation

#### Field-Specific Considerations
- **Tax Amounts:** Some fields marked as "tax_rate" but stored as decimal - semantic issue
- **Exchange Rates:** Stored similarly to amounts but semantically different
- **Virtual Fields:** `v_unit_price` computed from invoice lines, read-only
- **Currency Inconsistency:** All use CAD but no field stores currency code

**Recommendation:**
```typescript
// Subcategorize currency fields
const CurrencyPatterns = {
  costs: /(_cost|_expense)_amt$/i,         // Outflows
  revenue: /(_revenue|_income|_price|_charge)_amt$/i,  // Inflows
  budget: /(budget_|budgeted_).*_amt$/i,  // Allocations
  tax: /tax_.*_amt$/i,                    // Tax items
  discount: /(discount|rebate)_amt$/i,    // Reductions
  rate: /(tax_rate|exch_rate|standard_rate)$/i  // Rates (see Percentages)
};

// Metadata for currency fields
function getCurrencyMetadata(fieldName: string) {
  return {
    format: 'currency',
    currency: 'CAD',  // Could be from config
    decimals: 2,
    direction: isCostField(fieldName) ? 'outflow' : 'inflow',
    categories: detectCurrencyCategory(fieldName)
  };
}
```

---

### 5. BOOLEANS/FLAGS (39 columns)

**Purpose:** True/false feature toggles and status indicators  
**Pattern:** Prefixes `is_`, `has_` or suffix `_flag`  
**Data Types:** `boolean`, `BOOLEAN`

#### Examples (by category)
```
ROLE & PERMISSION FLAGS:
- client_facing_flag (1)          - Role can interact with clients
- system_role_flag (1)            - System-managed role
- management_role_flag (1)        - Supervisory role
- safety_critical_flag (1)        - Safety-critical position

REQUIREMENT FLAGS:
- background_check_required_flag (1)  - Background check needed
- bonding_required_flag (1)           - Bonding required
- licensing_required_flag (1)         - License required
- requires_certification_flag (1)     - Certification needed

STATUS & STATE FLAGS:
- active_flag (35 tables!)        - Record is active/inactive
- latest_version_flag (1)         - Latest version indicator
- terminal_state_flag (2)         - Workflow terminal state
- exception_state_flag (1)        - Exception state reached

FEATURE/CAPABILITY FLAGS:
- remote_work_eligible_flag (1)   - Can work remotely
- public_flag (1)                 - Publicly visible
- auto_refresh_enabled_flag (1)   - Auto-refresh enabled

FULFILLMENT FLAGS:
- customer_signature_flag (1)     - Signature received
- follow_up_required_flag (1)     - Follow-up needed
- is_primary_chunk (1)            - Primary content chunk

LOGISTICAL FLAGS:
- backorder_flag (1)              - Backordered
- dropship_flag (1)               - Dropship supplier
- priority_flag (1)               - Priority order
- tax_exempt_flag (2)             - Tax exempt status

FACILITY FLAGS:
- office_space_flag (1)           - Has office space
- equipment_storage_flag (1)      - Equipment storage available
- washroom_facilities_flag (1)    - Washroom available
- water_available_flag (1)        - Water available
- power_available_flag (1)        - Power available
- seasonal_use_flag (1)           - Seasonal facility

AVAILABILITY & SCHEDULING FLAGS:
- availability_flag (1)           - Available for scheduling
- confirmation_sent_flag (1)      - Confirmation email sent
- reminder_sent_flag (1)          - Reminder sent
```

#### Current Detection (Frontend)
```typescript
// Line 421
FIELD_PATTERNS.readonly: /^(is_|has_|flag|_flag).*|.*_flag$/i
```

⚠️ **CRITICAL BUG:** This pattern marks all boolean flags as READONLY! Should be EDITABLE.

#### Rendering Logic
- **Display:** Checkbox in forms, toggle in tables
- **Storage:** PostgreSQL boolean (true/false, not 0/1)
- **Filtering:** Yes/No filter options
- **Sorting:** Booleans sort ascending (false before true)
- **Icon:** Check icon for true, empty for false
- **Width:** 60px (compact)

#### Missing Detection Improvements
- ⚠️ Marked as readonly in current code - should be editable!
- ⚠️ `active_flag` appears 35 times - most critical flag
- ⚠️ Semantic categories not distinguished (permission vs operational vs feature)
- ⚠️ No default value handling (some should default to true, others false)

**Recommendation:**
```typescript
// FIX: Remove from readonly pattern!
// Move to explicit boolean pattern
FIELD_PATTERNS.boolean: /^(is_|has_).*|.*_flag$/i,

// Subcategorize booleans by semantic meaning
const BooleanCategories = {
  // Security & Permission
  permission: /(required|critical|facing)_flag$|^(is_|has_).*(admin|permission|role)/i,
  
  // Operational Status
  status: /^active_flag$|_status_flag$/i,
  
  // Feature Toggles
  feature: /(enabled|available|eligible|required|automatic)_flag$/i,
  
  // Tracking & Audit
  tracking: /(sent|received|confirmed|approved)_flag$/i,
  
  // Resource Capability
  capability: /(available|required)_flag$|^has_/i
};

// Metadata for boolean fields
function getBooleanMetadata(fieldName: string) {
  const category = detectBooleanCategory(fieldName);
  return {
    type: 'boolean',
    editable: true,  // ALWAYS editable!
    defaultValue: getDefaultForCategory(category),
    icon: category === 'status' ? 'Toggle' : 'Checkbox',
    category: category
  };
}
```

---

### 6. COUNTS/QUANTITIES (29 columns)

**Purpose:** Numeric counts, quantities, durations  
**Pattern:** Suffixes `_count`, `_qty`, `_hours`, `_minutes`, `_seconds`  
**Data Types:** `integer`, `numeric(10,2)`, `decimal(8,2)`

#### Examples (by type)
```
ITEM COUNTS:
- attachment_count (1)            - Number of attachments
- package_count (1)               - Number of packages
- message_count (1)               - Messages sent

QUANTITY/INVENTORY:
- reorder_qty (1)                 - Reorder quantity
- reorder_level_qty (1)           - Reorder threshold
- v_qty (2 tables)                - Virtual/computed quantity

TASK COUNTS:
- tasks_created_qty (1)           - Tasks created
- tasks_completed_qty (1)         - Tasks completed

TIME DURATIONS:
- actual_hours (1)                - Actual work hours
- estimated_hours (2)             - Estimated work hours
- labor_hours (1)                 - Labor hours
- reading_time_minutes (1)        - Article reading time
- cumulative_workflow_duration_minutes (1) - Total workflow time
- state_duration_minutes (1)      - Time in state
- sla_target_minutes (1)          - SLA target time
- sla_variance_minutes (1)        - SLA variance
- duration_seconds (1)            - Call duration
- talk_time_seconds (1)           - Agent talk time
- hold_time_seconds (1)           - Customer hold time
- wait_time_seconds (1)           - Queue wait time
- after_call_work_seconds (1)     - Post-call work

OTHER METRICS:
- execution_count (1)             - Execution count
- failure_count (1)               - Failed attempts
- retry_count (2)                 - Retry attempts
- data_freshness_hours (1)        - Data age
- resources_assigned_qty (1)      - Resources allocated
- attachments_added_qty (1)       - Attachments added
- word_count (1)                  - Article word count
```

#### Current Detection (Frontend)
```typescript
// Line 427
FIELD_PATTERNS.number: /..._id$|...|_id|/i  // Too broad, includes _id!

// Better:
if (FIELD_PATTERNS.number.test(key) && !FIELD_PATTERNS.readonly.test(key)) {
  return { editType: 'number' };
}
```

#### Rendering Logic
- **Display:** Integer format, no decimals for counts; decimals for duration/hours
- **Width:** 100px (right-aligned)
- **Editing:** Number input `<input type="number">`
- **Validation:** Non-negative integers
- **Aggregation:** SUM for reports
- **Default:** 0 for most fields

#### Missing Detection Improvements
- ⚠️ Semantic categories not distinguished (inventory vs task vs time-based)
- ⚠️ Time-based quantities need unit specification (hours, minutes, seconds)
- ⚠️ Decimals not consistently handled (some numeric(10,2) with 2 decimals)
- ⚠️ Virtual fields need read-only marking

**Recommendation:**
```typescript
// Enhanced detection with unit information
const QuantityPatterns = {
  // Inventory & Counts
  count: /(_count|_qty|_quantity)$/i,
  
  // Time durations (with units)
  duration: {
    hours: /(_hours|labor_hours|estimated_hours)$/i,
    minutes: /(_minutes|cumulative_workflow_duration_minutes)$/i,
    seconds: /(_seconds)$/i
  },
  
  // Metrics & Aggregates
  metric: /(failure|retry|execution|attachment)_count$/i
};

// Metadata for quantity fields
function getQuantityMetadata(fieldName: string) {
  const unit = detectQuantityUnit(fieldName);
  return {
    type: 'number',
    unit: unit,  // 'items', 'hours', 'minutes', 'seconds'
    format: unit === 'items' ? 'integer' : 'decimal',
    decimals: unit === 'items' ? 0 : 2,
    defaultValue: 0,
    nonNegative: true,
    aggregatable: true  // Can be SUMmed
  };
}
```

---

### 7. PERCENTAGES (6 columns)

**Purpose:** Percentage values (0-100 scale)  
**Pattern:** Suffixes `_pct` or `_percent`  
**Data Types:** `decimal(5,2)`, `numeric(5,2)`

#### Examples
```
discount_pct (1)              - Discount percentage
discount_percent (2)          - Discount (alternate naming)
margin_percent (2)            - Profit margin percentage
data_completeness_percent (1) - Data quality metric
success_rate_pct (1)          - Success rate percentage
tax_pct (1)                   - Tax rate percentage
```

#### Current Detection (Frontend)
```typescript
// Line 91 (in analysis script)
elif re.search(r'(_pct|_percent)$', col_name, re.IGNORECASE):
    patterns['Percentages'][col_name] = (count, type_str)

// BUT NOT in FIELD_PATTERNS!
```

**⚠️ Missing from data_transform_render.tsx!**

#### Rendering Logic
- **Display:** "25.5%"
- **Storage:** Decimal 0.0-100.0
- **Input:** Number input (0-100 range)
- **Validation:** 0 ≤ value ≤ 100
- **Sorting:** Numeric sort
- **Progress Bars:** Often displayed as progress indicators

**Recommendation:**
```typescript
// Add to FIELD_PATTERNS
FIELD_PATTERNS.percentage: /(_pct|_percent)$/i,

// In getFieldCapability()
if (FIELD_PATTERNS.percentage.test(key)) {
  return {
    inlineEditable: true,
    editType: 'number',
    isFileUpload: false,
    metadata: {
      min: 0,
      max: 100,
      step: 0.01,
      format: 'percentage',
      visualize: 'progress-bar'  // Optional visualization
    }
  };
}
```

---

### 8. DATALABELS (19 columns)

**Purpose:** Dropdown fields sourced from settings tables  
**Pattern:** Prefix `dl__` (data label)  
**Data Types:** `text`  
**Source:** `setting_datalabel` table (central repository)

#### Examples
```
WORKFLOW STAGES:
- dl__project_stage (1)          - Project lifecycle stages
- dl__task_stage (1)             - Task workflow stages
- dl__task_priority (1)          - Task priority levels
- dl__work_order_status (1)      - Work order status
- dl__quote_stage (1)            - Quote workflow

CUSTOMER/SALES:
- dl__customer_tier (1)          - Customer tier/level
- dl__customer_opportunity_funnel (1) - Sales funnel stage
- dl__acquisition_channel (1)    - Lead source channel
- dl__industry_sector (1)        - Industry classification

EMPLOYEE/ROLE:
- dl__employee_employment_type (1) - Employment type
- dl__employee_citizenship_status (1) - Citizenship
- dl__employee_security_clearance (1) - Security level

ORGANIZATIONAL:
- dl__office_hierarchy_level (1)    - Office tier
- dl__business_hierarchy_level (1)  - Business unit tier
- dl__product_hierarchy_level (1)   - Product category
- dl__product_brand (1)             - Product brand

ARTIFACT/DOCUMENT:
- dl__artifact_type (1)             - Document type
- dl__artifact_security_classification (1) - Security classification

FACILITIES:
- dl__worksite_safety_rating (1)    - Safety rating
```

#### Current Detection (Frontend)
```typescript
// Line 87 (in analysis)
elif re.search(r'^dl__', col_name):
    patterns['Datalabels'][col_name] = (count, type_str)

// In getFieldCapability() (line 479):
if (column.loadOptionsFromSettings) {
  return {
    inlineEditable: true,
    editType: 'select',
    loadOptionsFromSettings: true,
    settingsDatalabel: extractSettingsDatalabel(key),
    isFileUpload: false
  };
}
```

#### Smart Rendering
- **Dropdown Display:** Colored badges from settings
- **Colors:** From `setting_datalabel.metadata.color_code`
- **Sorting:** By `display_order` field
- **Filtering:** Multi-select filters
- **Special:** Stage/funnel fields display as DAG (Directed Acyclic Graph)
- **Function:** `renderSettingBadge(value, { datalabel: 'project_stage' })`

#### DAG Visualization for Workflow Stages
Datalabel fields containing "stage" or "funnel" automatically use DAGVisualizer:
```typescript
// Example: dl__project_stage
// Fetches workflow stages from setting_datalabel
// Displays as: initiation → planning → execution → closure
// User can move task through stages by dragging in DAG view
```

#### Missing Detection Improvements
- ⚠️ Not all dl__ fields should be datalabels (some are generic identifiers)
- ⚠️ Stage/funnel fields need special DAG handling - not just dropdowns
- ⚠️ Should validate that dl__* field exists in setting_datalabel table
- ⚠️ Rename suggestions: dl__* naming is unintuitive for non-developers

**Recommendation:**
```typescript
// Detect datalabel pattern
FIELD_PATTERNS.datalabel: /^dl__/i,

// Subcategorize by semantic type
const DatalabelTypes = {
  workflow_stage: /_(stage|status|funnel)$/i,  // Use DAGVisualizer
  hierarchy: /_hierarchy_level$/i,             // Show as tree/indent
  category: /_type$|_tier$|_brand$/i,          // Standard dropdown
  classification: /_classification$|_clearance$|_rating$/i, // Specialized
  channel: /_channel$|_source$/i               // Channel-specific
};

// Metadata for datalabel fields
function getDatalabelMetadata(fieldName: string) {
  return {
    type: 'select',
    loadOptionsFromSettings: true,
    settingsDatalabel: extractSettingsDatalabel(fieldName),
    semanticType: detectDatalabelType(fieldName),
    visualization: isDatalabelStage(fieldName) ? 'dag' : 'dropdown',
    colorCoded: true,  // From metadata.color_code
    sortBy: 'display_order'
  };
}
```

---

### 9. STANDARD FIELDS (5 columns)

**Purpose:** Core descriptive fields present in most entities  
**Pattern:** `name`, `code`, `descr`, `description`, `title`  
**Data Types:** `text`, `varchar(100)`, `varchar(200)`

#### Distribution
```
name (28 tables)        - Primary entity name/label
code (28 tables)        - Code/identifier (shorter name)
descr (27 tables)       - Description/narrative
title (2 tables)        - Alternative label (wiki, calendar)
description (1 table)   - Longer description
```

#### Current Detection (Frontend)
```typescript
// Line 518 in data_transform_render.tsx
const isSimpleTextField = /^(name|descr|description|title|notes|comments?)$/i.test(key);
if (isSimpleTextField) {
  return {
    inlineEditable: true,
    editType: 'text',
    isFileUpload: false
  };
}
```

#### Rendering Logic
- **Display Width:**
  - `name`: 300px (primary identifier)
  - `code`: 150px (technical identifier)
  - `descr`: 400px (full-width content)
- **Sorting:** Alphabetically by default
- **Filtering:** Text search/contains
- **Editing:** Text input or textarea
- **Validation:** No special validation (business-rule dependent)

#### Special Handling
- **Search:** `name` and `code` typically included in full-text search
- **Display Order:** `name`, `code`, `descr` should appear first
- **Primary Key:** `name` often serves as visual primary key (even though id is database PK)

---

### 10. JSONB/METADATA (38 columns)

**Purpose:** Store semi-structured data, flexible schemas  
**Data Types:** `jsonb`, `JSONB`  
**Storage:** PostgreSQL native JSON type with indexing

#### Examples (by use case)
```
STRUCTURAL/SCHEMA:
- metadata (30 tables!)      - General entity metadata
- form_schema (1)            - Form structure definition
- template_schema (2)        - Email template schema
- workflow_graph (1)         - Workflow DAG structure
- workflow_graph_data (1)    - Workflow data structure
- query_definition (1)       - Report query definition
- data_source_config (1)     - Data source configuration
- visualization_config (1)   - Report visualization config

CONTENT/DATA:
- submission_data (1)        - Form submission payload
- content (1)                - Wiki content (JSON)
- content_data (1)           - Message content
- content_metadata (2)       - Content metadata
- report_data (1)            - Report data structure
- geo_coordinates (1)        - Geographic coordinates

STATE/SESSION:
- session_context (1)        - Chat session context
- input_state (1)            - Agent input state
- output_state (1)           - Agent output state
- state_snapshot (1)         - Workflow state snapshot
- variables_snapshot (1)     - Variable values snapshot

DECISION/RESULT:
- decision (1)               - Agent decision
- error_details (1)          - Error information
- input_data (1)             - Agent input data
- output_data (1)            - Agent output data
- mcp_tool_result (1)        - MCP tool execution result
- mcp_tool_args (1)          - MCP tool arguments

LISTS/ARRAYS:
- quote_items (1)            - Line items in quote
- required_certifications (1) - Required certifications
- required_skills (1)        - Required skills list
- emergency_contact (1)      - Emergency contact info
- environmental_permits (1)  - Permits list
- event_metadata (2)         - Event details

AUTH/SECURITY:
- auth_metadata (1)          - Authentication metadata
- trigger_conditions (1)     - Trigger condition rules

COMPUTED/RICH:
- child_entities (1)         - Child entity metadata (d_entity)
- interaction_person_entities (1) - People in interaction
```

#### Current Detection (Frontend)
```typescript
// Line 95 in analysis script
elif 'jsonb' in type_str.lower():
    patterns['JSONB/Metadata'][col_name] = (count, type_str)

// NOT explicitly handled in data_transform_render.tsx!
```

**⚠️ Missing from field capability detection!**

#### Rendering Logic
- **Display:** "..." indicator (not displayed inline)
- **Editing:** JSON editor modal
- **Storage:** Native PostgreSQL JSONB (supports full-text search, indexing)
- **Size:** Unbounded (used for large payloads)
- **Format:** Typically don't show inline, show in detail view

#### Schema Patterns
- **Generic `metadata`:** Custom key-value pairs per entity type
- **Typed schemas:** `form_schema`, `workflow_graph` have specific structure
- **Audit data:** `submission_data`, `error_details` store immutable snapshots

**Recommendation:**
```typescript
// Add JSONB detection
FIELD_PATTERNS.jsonb: (column) => column.dataType?.includes('jsonb'),

// In getFieldCapability()
if (isJsonbField(column)) {
  return {
    inlineEditable: true,
    editType: 'jsonb',
    isFileUpload: false,
    metadata: {
      schema: getJsonSchema(column.key),  // Optional schema validation
      editor: 'json-modal',               // Don't edit inline
      maxHeight: '500px',
      validate: validateJson
    }
  };
}
```

---

### 11. ARRAYS (28 columns)

**Purpose:** Store lists of values (PostgreSQL native arrays)  
**Data Types:** `uuid[]`, `text[]`, `varchar[]`, `integer[]`

#### Examples (by element type)
```
UUID ARRAYS:
- tags (4 tables)                   - Generic tags (mixed use)
- assigned_technician_ids (1)       - Team members
- stakeholder_employee_ids (1)      - Stakeholders
- email_subscribers (1)             - Subscriber list
- attached_artifacts (1)            - Related artifacts
- attachment_ids (1)                - Attachment references
- related_interaction_ids (1)       - Related interactions
- v_product_ids (1)                 - Virtual product references
- v_store_ids (1)                   - Virtual store references

TEXT ARRAYS:
- skills_service_categories (1)     - Service categories
- emotion_tags (1)                  - Emotion classification
- keywords (1)                      - Article keywords
- external_links (1)                - External URLs
- internal_links (1)                - Internal cross-references
- entities (1)                      - Entity references
- v_cities (1)                      - Multiple cities
- v_departments (1)                 - Departments
- v_first_names (1)                 - First names
- v_last_names (1)                  - Last names
- v_skills (1)                      - Skills list
- v_titles (1)                      - Job titles
- v_provinces (1)                   - Provinces
- v_province_codes (1)              - Province codes
- v_streets (1)                     - Street names
- v_client_names (1)                - Client names

VARCHAR ARRAYS:
- edit_access_groups (1)            - Group access control
- read_access_groups (1)            - Read permissions
- permission (1) [integer[]]        - Role permissions (bit flags)
```

#### Current Detection (Frontend)
```typescript
// Line 97 in analysis script
elif '[]' in type_str:
    patterns['Arrays'][col_name] = (count, type_str)

// NOT in data_transform_render.tsx!
```

**⚠️ Detected in column analysis but not in field capability system!**

#### Rendering Logic
- **Display:** Comma-separated list with tags-style badges
- **Editing:** Tags input (comma-separated or multi-select)
- **Storage:** Native PostgreSQL arrays (efficient)
- **Filtering:** Contains ANY/ALL operators
- **Function:** `renderTags(array, maxVisible)` (line 953)

#### Transformation
- **Input:** Comma-separated string from user "tag1, tag2, tag3"
- **API:** Transforms to array ["tag1", "tag2", "tag3"]
- **Display:** `transformFromApi()` converts back to "tag1, tag2, tag3"
- **Function:** `transformArrayField()` (line 146)

**Recommendation:**
```typescript
// Add array detection
FIELD_PATTERNS.array: (column) => column.dataType?.includes('[]'),

// In getFieldCapability()
if (isArrayField(column)) {
  return {
    inlineEditable: true,
    editType: 'tags',  // Or 'multiselect' based on context
    isFileUpload: false,
    metadata: {
      elementType: detectArrayElementType(column),  // 'uuid', 'text', etc.
      maxTags: 10,
      separator: ',',
      allowCustom: /^tags$/.test(column.key)  // Generic tags allow custom values
    }
  };
}
```

---

### 12. OTHER/CONTEXT-DEPENDENT (486 columns)

**Purpose:** Domain-specific fields requiring context interpretation  
**Coverage:** ~61% of all columns  
**Examples:** email, phone, address, status, channel, etc.

These fields don't match standard patterns but require semantic understanding:

#### Contact Fields (5+ columns)
```
address_line1, address_line2, city, country, postal_code
phone, mobile, email, fax
```

#### Business Fields (20+ columns)
```
business_type, business_number, business_legal_name
client_type, client_tier, client_name
supplier_name, vendor_name
```

#### Status/State Fields (15+ columns)
```
approval_status, payment_status, fulfillment_status
channel, content_format, consent_type
value_type, workflow_state
```

#### Identifier/Code Fields (10+ columns)
```
cost_code, cost_center, accounting_period
billing_cycle, agent_role, agent_type
bill_of_lading, carrier_name, warehouse_location
```

---

## Part 3: Current Implementation Gap Analysis

### What's Implemented (Frontend)

✅ **WORKING:**
```typescript
// apps/web/src/lib/data_transform_render.tsx
- Timestamps: /(ts|_at)$/ → formatRelativeTime()
- Dates: /_date$/ → date input + formatFriendlyDate()
- Tags: /^tags$|_tags$/ → tags input
- Files: attachment, document → file upload
- Numbers: /_id$/ → number input (TOO BROAD)
- Settings: loadOptionsFromSettings flag → dropdown
- Booleans: readonly pattern (WRONG - should be editable!)
- Currency: via isCurrencyField() → formatCurrency()

```

⚠️ **MISSING or BROKEN:**
```typescript
- Percentages: /(_pct|_percent)$/ ← NOT IMPLEMENTED
- JSONB: No detection, no editor
- Arrays: No detection (partially handled via tags)
- Foreign Keys: Detected but marked readonly
- System Timestamps: (from_ts, to_ts) mixed with business timestamps
- Virtual Fields: (v_* prefix) not marked as readonly
- Date Ranges: Single fields, not linked ranges
- Boolean Categories: Permissions vs Feature vs Status not distinguished
- Datalabel Stages: Need DAG visualization, not just dropdown
```

### Backend Transformation (Minimal)

✅ **WORKING:**
```typescript
// apps/api/src/lib/data-transformers.ts
- transformTags() - string → array
- transformDateField() - ISO → yyyy-MM-dd
- transformRequestBody() - handles empty strings
```

⚠️ **MISSING:**
```typescript
- No percentage handling
- No JSONB validation
- No array type checking
- No currency validation
- No FK existence checking
```

---

## Part 4: Recommended Enhancement

### Step 1: Expand Field Detection Pattern Registry

```typescript
// NEW FILE: apps/web/src/lib/fieldDetection.ts

export const FIELD_DETECTION_PATTERNS = {
  // Timestamps
  timestamp: {
    patterns: [/_ts$/, /_at$/, /_timestamp$/i, /^(created|updated|modified)_/i],
    categories: {
      system: /^(created_ts|updated_ts|from_ts|to_ts)$/i,
      business: /(last_|_ts)$/i,
      event: /(approved|published|completed|started)_ts$/i
    },
    dataType: ['timestamptz', 'TIMESTAMP'],
    formatRules: {
      display: 'relative',        // "3 days ago"
      precision: 'second',
      timezone: 'auto'
    }
  },

  // Dates
  date: {
    patterns: [/_date$/i, /^date_/i],
    categories: {
      range_start: /(start|begin|from)_date$/i,
      range_end: /(end|finish|to)_date$/i,
      specific: /(hire|birth|invoice|order|shipment)_date$/i
    },
    dataType: ['date', 'DATE'],
    formatRules: {
      display: 'friendly',        // "Oct 28, 2024"
      picker: 'date',
      range: { detect: true }
    }
  },

  // Foreign Keys
  foreignKey: {
    patterns: [/_id$/i],
    categories: {
      entity: /^(project|task|employee|office|product|client|order|artifact|form|wiki|service|event)_id$/i,
      polymorphic: /(parent|child)_(entity_)?id$|entity_id$/i,
      system: /^(user|session|tenant|workspace|account)_id$/i,
      hierarchy: /^parent_id$/i,
      audit: /(created|updated)_by_(employee)?id$/i
    },
    dataType: ['uuid', 'UUID', 'text', 'int4'],
    visibility: false,  // Hide FK columns
    autoGenerateNameColumn: true
  },

  // Amounts/Currency
  currency: {
    patterns: [/_amt$/i, /_price$/i, /_cost$/i, /_rate$/i],
    categories: {
      cost: /(_cost|_expense)_amt$/i,
      revenue: /(_revenue|_income|_price|_charge)_amt$/i,
      budget: /(budget_|budgeted_).*_amt$/i,
      tax: /tax_.*_amt$/i,
      discount: /(discount|rebate)_amt$/i
    },
    dataType: ['decimal(15,2)', 'numeric(10,2)', 'DECIMAL(5,*)'],
    formatRules: {
      format: 'currency',
      currency: 'CAD',
      decimals: 2,
      alignment: 'right',
      width: '120px'
    }
  },

  // Booleans
  boolean: {
    patterns: [/^(is_|has_)/, /_flag$/i],
    categories: {
      permission: /(required|critical|facing)_flag$/i,
      status: /^active_flag$/i,
      feature: /(enabled|available|eligible|required|automatic)_flag$/i,
      tracking: /(sent|received|confirmed|approved)_flag$/i
    },
    dataType: ['boolean', 'BOOLEAN'],
    editable: true,  // FIX: Currently marked readonly!
    defaultValue: { default: false, category_specific: { status: true } }
  },

  // Counts/Quantities
  quantity: {
    patterns: [/_count$/i, /_qty$/i, /_hours$/i, /_minutes$/i, /_seconds$/i],
    categories: {
      count: /(_count|_qty|_quantity)$/i,
      duration_hours: /(_hours|labor_hours|estimated_hours)$/i,
      duration_minutes: /(_minutes)$/i,
      duration_seconds: /(_seconds)$/i,
      metric: /(failure|retry|execution)_count$/i
    },
    dataType: ['integer', 'int', 'numeric(10,2)', 'decimal(8,2)'],
    formatRules: {
      format: (key) => /(_count|_qty)$/i.test(key) ? 'integer' : 'decimal',
      decimals: (key) => /(_count|_qty)$/i.test(key) ? 0 : 2,
      nonNegative: true
    }
  },

  // Percentages
  percentage: {
    patterns: [/_pct$/i, /_percent$/i],
    categories: {
      discount: /discount_/i,
      margin: /margin_/i,
      tax: /tax_/i,
      success: /success_/i,
      completion: /completion_/i
    },
    dataType: ['decimal(5,2)', 'numeric(5,2)', 'DECIMAL(5,*)'],
    formatRules: {
      format: 'percentage',
      min: 0,
      max: 100,
      decimals: 2,
      visualization: 'progress-bar'
    }
  },

  // Datalabels (Settings-Driven)
  datalabel: {
    patterns: [/^dl__/i],
    categories: {
      workflow: /(stage|status|funnel)$/i,
      hierarchy: /_hierarchy_level$/i,
      category: /_type$|_tier$|_brand$/i,
      classification: /_classification$|_clearance$|_rating$/i
    },
    dataType: ['text'],
    renderRules: {
      type: 'select',
      source: 'settings',
      colorCoded: true,
      visualization: (key) => /(stage|funnel)$/i.test(key) ? 'dag' : 'dropdown'
    }
  },

  // Standard Fields
  standard: {
    patterns: [/^name$/i, /^code$/i, /^descr$/i, /^description$/i, /^title$/i],
    dataType: ['text', 'varchar'],
    formatRules: {
      width: (key) => {
        if (/^name$/i.test(key)) return '300px';
        if (/^code$/i.test(key)) return '150px';
        return '300px';
      },
      searchable: true,
      displayOrder: 10  // Show first
    }
  },

  // JSONB
  jsonb: {
    patterns: [],  // Detected by dataType
    categories: {
      structural: /schema|graph|config|definition$/i,
      content: /(submission|content|data)_/i,
      state: /(state|context|snapshot)$/i,
      list: /items$|certifications$|skills$/i
    },
    dataType: ['jsonb', 'JSONB'],
    renderRules: {
      editor: 'json-modal',
      inline: false,
      maxHeight: '500px',
      validation: (key) => getJsonSchemaFor(key)
    }
  },

  // Arrays
  array: {
    patterns: [],  // Detected by dataType
    categories: {
      uuid: /uuid\[\]/i,
      text: /text\[\]/i,
      tags: /^tags$/i
    },
    dataType: ['uuid[]', 'text[]', 'varchar[]', 'integer[]'],
    renderRules: {
      display: 'tags',
      editor: 'tags-input',
      separator: ',',
      maxTags: 20
    }
  }
};
```

### Step 2: Implement Universal Field Capability Detector

```typescript
// ENHANCED: apps/web/src/lib/data_transform_render.tsx

export interface FieldMetadata {
  // Display
  display: {
    type: string;           // 'timestamp', 'currency', etc.
    format: string;         // 'relative', 'currency', 'percentage'
    width?: string;
    alignment?: 'left' | 'center' | 'right';
    sortable?: boolean;
    filterable?: boolean;
  };
  
  // Editing
  editing: {
    editable: boolean;
    inputType: 'text' | 'number' | 'date' | 'select' | 'tags' | 'jsonb' | 'file';
    dataList?: string[];  // For dropdowns
    validation?: (value: any) => string | null;
    transformation?: (value: any) => any;
  };
  
  // Rendering
  rendering: {
    component?: string;  // 'currency-badge', 'date-badge', etc.
    colorCoded?: boolean;
    icon?: string;
    visualization?: string;
  };
  
  // Metadata
  metadata: {
    category?: string;
    unit?: string;  // For quantities: 'hours', 'minutes'
    defaultValue?: any;
    readonly?: boolean;
    hidden?: boolean;
  };
}

/**
 * UNIVERSAL FIELD DETECTOR
 * 
 * Single function that analyzes a field name and data type
 * to return COMPLETE metadata for display, editing, and rendering.
 */
export function detectFieldMetadata(
  columnName: string,
  dataType?: string,
  columnConfig?: ColumnDef
): FieldMetadata {
  const key = columnName.toLowerCase();
  const type = dataType?.toLowerCase() || '';
  
  // Check each pattern registry in order
  for (const [patternName, pattern] of Object.entries(FIELD_DETECTION_PATTERNS)) {
    if (matchesPattern(key, type, pattern)) {
      return buildMetadataFromPattern(columnName, pattern);
    }
  }
  
  // Default: text field
  return {
    display: { type: 'text', format: 'text', sortable: true, filterable: true },
    editing: { editable: true, inputType: 'text' },
    rendering: { component: 'text-cell' },
    metadata: { category: 'general' }
  };
}

function matchesPattern(key: string, type: string, pattern: any): boolean {
  if (pattern.patterns && Array.isArray(pattern.patterns)) {
    return pattern.patterns.some(p => p.test ? p.test(key) : p === key);
  }
  if (pattern.dataType && Array.isArray(pattern.dataType)) {
    return pattern.dataType.some(dt => type.includes(dt));
  }
  return false;
}

function buildMetadataFromPattern(fieldName: string, pattern: any): FieldMetadata {
  const key = fieldName.toLowerCase();
  
  return {
    display: {
      type: pattern.displayType || pattern.type,
      format: pattern.formatRules?.display || 'text',
      width: pattern.formatRules?.width,
      alignment: pattern.formatRules?.alignment,
      sortable: pattern.formatRules?.sortable !== false,
      filterable: pattern.formatRules?.filterable !== false
    },
    editing: {
      editable: pattern.editable !== false,
      inputType: pattern.editInputType || 'text',
      dataList: pattern.dataList,
      validation: pattern.validation
    },
    rendering: {
      component: pattern.renderComponent,
      colorCoded: pattern.colorCoded,
      visualization: pattern.visualization
    },
    metadata: {
      category: pattern.category,
      readonly: pattern.readonly === true
    }
  };
}
```

### Step 3: Integration Points

1. **EntityConfig Generation** - Use detector to auto-configure columns
2. **DataTable Rendering** - Apply metadata for display rules
3. **Form Generation** - Apply metadata for input types
4. **Field Validation** - Apply validation rules
5. **API Transformation** - Apply transformation rules

---

## Part 5: Field Detection Implementation Checklist

### Frontend (React/TypeScript)
- [ ] Create `fieldDetection.ts` with pattern registry
- [ ] Implement `detectFieldMetadata()` function
- [ ] Update `getFieldCapability()` to use pattern registry
- [ ] Add percentage pattern detection
- [ ] Add JSONB field support
- [ ] Fix boolean fields (currently marked readonly!)
- [ ] Add virtual field detection (v_* prefix)
- [ ] Improve FK detection and auto-name generation
- [ ] Add date range pair detection
- [ ] Implement DAG visualization for stage/funnel fields

### Backend (Fastify/TypeScript)
- [ ] Extend `data-transformers.ts` with pattern detection
- [ ] Add percentage validation
- [ ] Add JSONB schema validation
- [ ] Add array type checking
- [ ] Add currency validation (max 2 decimals)
- [ ] Add FK existence checking
- [ ] Add enum validation for datalabels

### Database
- [ ] Document column naming conventions
- [ ] Add column-level metadata (e.g., `COMMENT ON COLUMN`)
- [ ] Validate all dl__ fields exist in setting_datalabel
- [ ] Ensure FK relationships properly configured

### Testing
- [ ] Test detection against all 802 columns
- [ ] Test pattern matching for edge cases
- [ ] Test transformation for each field type
- [ ] Test validation rules

---

## Appendix: Complete Column List by Pattern

*[Full list of 802 columns already provided in /tmp/column_analysis.txt]*

---

## Summary Statistics

| Aspect | Count | Coverage |
|--------|-------|----------|
| **Total Columns** | 802 | 100% |
| **Named Patterns** | 316 | 39% |
| **Context-Dependent** | 486 | 61% |
| **Explicitly Editable** | ~550 | 69% |
| **Read-Only (System)** | ~50 | 6% |
| **Hidden (FK columns)** | ~59 | 7% |
| **Requires Config** | ~150 | 19% |

---

**Prepared for:** Universal Field Detector Implementation  
**Document:** Complete Column Analysis & Pattern Detection Guide  
**Last Updated:** 2025-11-12

