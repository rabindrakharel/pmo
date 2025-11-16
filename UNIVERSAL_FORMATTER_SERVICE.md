# Universal Formatter Service - Complete Guide

**File**: `apps/api/src/lib/schema-builder.service.ts`

## Overview

ONE service that determines **everything** from **naming convention + data type**:

```
Column Name + Data Type
         ↓
Schema Builder Service
         ↓
Determines:
  - Frontend Label
  - Display Format (currency, date, badge, etc.)
  - Input Type (text, number, select, checkbox, etc.)
  - Sortable/Filterable
  - Width & Alignment
  - Editable/Readonly
```

---

## Naming Convention Rules

### 1. Currency Fields → Currency Formatting

**Pattern**: `*_amt`, `*_amount`, `*_price`, `*_cost`, `budget_*`, `revenue_*`, `expense_*`

```typescript
// Database
budget_allocated_amt  NUMERIC

// Auto-Generated Schema
{
  key: 'budget_allocated_amt',
  title: 'Budget Allocated',          // ✅ Auto-generated label
  dataType: 'numeric',
  format: { type: 'currency' },       // ✅ Auto-format: $50,000.00
  editType: 'number',                 // ✅ Auto-input: <input type="number">
  sortable: true,                     // ✅ Auto-sortable
  filterable: true,                   // ✅ Auto-filterable
  width: '120px',                     // ✅ Auto-width
  align: 'right',                     // ✅ Auto-align
  editable: true
}
```

**Examples**:
- `budget_allocated_amt` → "Budget Allocated" | `$50,000.00`
- `total_cost` → "Total Cost" | `$1,234.56`
- `unit_price` → "Unit Price" | `$99.99`
- `revenue_forecast` → "Revenue Forecast" | `$1,000,000.00`

---

### 2. Settings/Dropdown Fields → Badge Formatting

**Pattern**: `dl__*` (datalabel prefix)

```typescript
// Database
dl__project_stage  VARCHAR

// Auto-Generated Schema
{
  key: 'dl__project_stage',
  title: 'Project Stage',             // ✅ Strips dl__ prefix
  dataType: 'varchar',
  format: {
    type: 'badge',
    settingsDatalabel: 'project_stage' // ✅ Auto-links to settings table
  },
  editType: 'select',                 // ✅ Auto-dropdown
  dataSource: {
    type: 'settings',
    datalabel: 'project_stage'        // ✅ Fetches from API
  },
  sortable: true,
  filterable: true,
  width: '150px',
  align: 'center',                    // ✅ Center-aligned badges
  editable: true
}
```

**Display**: Colored badge with setting color
**Edit**: Dropdown populated from `/api/v1/entity/project/options?field=dl__project_stage`

**Examples**:
- `dl__project_stage` → "Project Stage" | 🟢 "In Progress"
- `dl__task_priority` → "Task Priority" | 🔴 "High"
- `dl__employee_status` → "Employee Status" | 🟡 "Active"

---

### 3. Timestamp Fields → Relative Time

**Pattern**: `*_ts`, `*_at` with `timestamp` type

```typescript
// Database
updated_ts  TIMESTAMP WITH TIME ZONE

// Auto-Generated Schema
{
  key: 'updated_ts',
  title: 'Updated',                   // ✅ Removes _ts suffix
  dataType: 'timestamp with time zone',
  format: { type: 'relative-time' },  // ✅ "2 hours ago"
  editType: 'date',
  sortable: true,
  filterable: true,
  width: '150px',
  align: 'left',
  editable: false                     // ✅ System fields readonly
}
```

**Examples**:
- `updated_ts` → "Updated" | "2 hours ago"
- `created_ts` → "Created" | "5 days ago"
- `last_login_at` → "Last Login" | "3 minutes ago"

---

### 4. Date Fields → Date Formatting

**Pattern**: Data type = `date`

```typescript
// Database
start_date  DATE

// Auto-Generated Schema
{
  key: 'start_date',
  title: 'Start Date',
  dataType: 'date',
  format: {
    type: 'date',
    dateFormat: 'MMM DD, YYYY'        // ✅ Jan 15, 2025
  },
  editType: 'date',                   // ✅ Date picker
  sortable: true,
  filterable: true,
  width: '120px',
  align: 'left',
  editable: true
}
```

**Examples**:
- `start_date` → "Start Date" | "Jan 15, 2025"
- `end_date` → "End Date" | "Dec 31, 2025"
- `due_date` → "Due Date" | "Mar 20, 2025"

---

### 5. Datetime Fields → DateTime Formatting

**Pattern**: `timestamp` type (NOT ending in `_ts` or `_at`)

```typescript
// Database
scheduled_datetime  TIMESTAMP WITH TIME ZONE

// Auto-Generated Schema
{
  key: 'scheduled_datetime',
  title: 'Scheduled Datetime',
  dataType: 'timestamp with time zone',
  format: { type: 'datetime' },       // ✅ Jan 15, 2025, 2:30 PM
  editType: 'date',
  sortable: true,
  filterable: true,
  width: '150px',
  align: 'left',
  editable: true
}
```

---

### 6. Boolean Fields → Checkbox

**Pattern**: Data type = `boolean`

```typescript
// Database
active_flag  BOOLEAN

// Auto-Generated Schema
{
  key: 'active_flag',
  title: 'Active Flag',
  dataType: 'boolean',
  format: { type: 'boolean' },        // ✅ Badge: Active/Inactive
  editType: 'boolean',                // ✅ Checkbox input
  sortable: true,
  filterable: true,
  width: '100px',
  align: 'center',
  editable: true
}
```

**Display**: "Active" (green badge) or "Inactive" (gray badge)
**Edit**: `<input type="checkbox">`

**Examples**:
- `active_flag` → 🟢 "Active" or ⚪ "Inactive"
- `is_billable` → "Yes" or "No"
- `completed` → "Yes" or "No"

---

### 7. Percentage Fields → Percentage Formatting

**Pattern**: `*_pct`, `*_percentage`, `*_rate`

```typescript
// Database
completion_pct  NUMERIC

// Auto-Generated Schema
{
  key: 'completion_pct',
  title: 'Completion',                // ✅ Removes _pct suffix
  dataType: 'numeric',
  format: { type: 'percentage' },     // ✅ 75.0%
  editType: 'number',
  sortable: true,
  filterable: true,
  width: '100px',
  align: 'right',
  editable: true
}
```

**Examples**:
- `completion_pct` → "Completion" | "75.0%"
- `discount_rate` → "Discount Rate" | "15.0%"
- `tax_percentage` → "Tax Percentage" | "13.0%"

---

### 8. Reference Fields → Entity Link

**Pattern**: `*_id` with `uuid` type (e.g., `project_id`, `employee_id`)

```typescript
// Database
manager_employee_id  UUID

// Auto-Generated Schema
{
  key: 'manager_employee_id',
  title: 'Manager Employee',          // ✅ Removes _id suffix
  dataType: 'uuid',
  format: {
    type: 'reference',
    entityType: 'employee'            // ✅ Auto-detects entity type
  },
  editType: 'text',                   // Will be select in future
  sortable: true,
  filterable: true,
  visible: false,                     // ✅ ID fields hidden by default
  editable: true
}
```

**Recognized entities**: `employee`, `project`, `task`, `business`, `office`, `customer`, `role`, `event`, `calendar`, `booking`

**Examples**:
- `project_id` → Hidden (used for joins)
- `manager_employee_id` → Hidden
- `assigned_task_id` → Hidden

---

### 9. Tag/Array Fields → Tag List

**Pattern**: Data type = `ARRAY` or `_*` prefix or column name = `tags`

```typescript
// Database
tags  TEXT[]

// Auto-Generated Schema
{
  key: 'tags',
  title: 'Tags',
  dataType: 'ARRAY',
  format: { type: 'tags' },           // ✅ Renders as tag badges
  editType: 'tags',                   // ✅ Tag input widget
  sortable: false,                    // ✅ Arrays not sortable
  filterable: true,
  width: '150px',
  align: 'left',
  editable: true
}
```

**Display**: `kitchen` `renovation` `urgent` `+2 more`

---

### 10. Numeric Fields → Number Formatting

**Pattern**: `integer`, `bigint`, `numeric`, `decimal`, `double precision`, `real`

```typescript
// Database
quantity  INTEGER

// Auto-Generated Schema
{
  key: 'quantity',
  title: 'Quantity',
  dataType: 'integer',
  format: { type: 'number' },         // ✅ 1,234
  editType: 'number',                 // ✅ <input type="number">
  sortable: true,
  filterable: true,
  width: '100px',
  align: 'right',                     // ✅ Right-aligned numbers
  editable: true
}
```

**Examples**:
- `quantity` → "Quantity" | "1,234"
- `employee_count` → "Employee Count" | "42"
- `priority_order` → "Priority Order" | "5"

---

### 11. Text Fields → Plain Text

**Pattern**: `varchar`, `text`, or any unmatched type

```typescript
// Database
name  VARCHAR

// Auto-Generated Schema
{
  key: 'name',
  title: 'Name',
  dataType: 'varchar',
  format: { type: 'text' },           // ✅ Plain text
  editType: 'text',                   // ✅ <input type="text">
  sortable: true,
  filterable: true,
  width: '200px',                     // ✅ Name fields wider
  align: 'left',
  editable: true
}
```

**Examples**:
- `name` → "Name" | "Kitchen Renovation"
- `code` → "Code" | "PROJ-2025-001"
- `descr` → "Descr" | "Complete kitchen remodel"

---

## Title Generation Rules

### Pattern Transformations

```typescript
// 1. Remove prefixes/suffixes
'dl__project_stage'      → 'project_stage'    (strip dl__)
'updated_ts'             → 'updated'          (strip _ts)
'budget_allocated_amt'   → 'budget_allocated' (strip _amt)
'manager_employee_id'    → 'manager_employee' (strip _id)

// 2. Convert snake_case to Title Case
'project_stage'          → 'Project Stage'
'budget_allocated'       → 'Budget Allocated'
'manager_employee'       → 'Manager Employee'
```

### Special Cases

```typescript
'name'     → 'Name'
'code'     → 'Code'
'descr'    → 'Descr'
'id'       → 'Id'
'metadata' → 'Metadata'
```

---

## Width & Alignment Rules

### Width

| Pattern | Width | Reason |
|---------|-------|--------|
| `*_amt`, `*_amount`, `*_price`, `*_cost` | `120px` | Currency needs space |
| `date` | `120px` | Date format length |
| `timestamp` | `150px` | Datetime format length |
| `boolean` | `100px` | Badge space |
| `code` | `120px` | Standard code length |
| `name` | `200px` | Name fields wider |
| Default | `150px` | Standard width |

### Alignment

| Pattern | Alignment | Reason |
|---------|-----------|--------|
| Numeric types | `right` | Standard accounting practice |
| `boolean` | `center` | Visual balance |
| `dl__*` (badges) | `center` | Visual balance |
| All others | `left` | Default text alignment |

---

## Sortable & Filterable Rules

### Sortable

| Pattern | Sortable | Reason |
|---------|----------|--------|
| `tags` | `false` | Arrays complex to sort |
| `metadata` | `false` | JSON complex to sort |
| All others | `true` | Most fields sortable |

### Filterable

| Pattern | Filterable |
|---------|------------|
| All fields | `true` |

---

## Editable & Readonly Rules

### Readonly Fields (System Fields)

```typescript
READONLY_FIELDS = [
  'id',
  'created_ts',
  'updated_ts',
  'created_by',
  'updated_by',
  'from_ts',
  'to_ts',
  'parent_id',
  'parent_type',
  'parent_name',
  'child_count'
]
```

### Hidden Fields (System Fields)

```typescript
SYSTEM_FIELDS = [
  'id',               // Primary key
  'created_ts',       // Audit field
  'updated_ts',       // Audit field
  'created_by',       // Audit field
  'updated_by',       // Audit field
  'from_ts',          // Temporal field
  'to_ts',            // Temporal field
  'active_flag',      // Status field
  'version'           // Version control
]
```

---

## Complete Example: Project Table

### Database Schema

```sql
CREATE TABLE d_project (
  id UUID PRIMARY KEY,
  code VARCHAR,
  name VARCHAR,
  descr TEXT,
  dl__project_stage VARCHAR,
  manager_employee_id UUID,
  budget_allocated_amt NUMERIC,
  start_date DATE,
  completion_pct NUMERIC,
  active_flag BOOLEAN,
  tags TEXT[],
  updated_ts TIMESTAMP WITH TIME ZONE,
  created_ts TIMESTAMP WITH TIME ZONE
);
```

### Auto-Generated Schema

```typescript
{
  entityType: 'project',
  tableName: 'd_project',
  columns: [
    {
      key: 'code',
      title: 'Code',
      dataType: 'varchar',
      format: { type: 'text' },
      editType: 'text',
      width: '120px',
      align: 'left',
      sortable: true,
      filterable: true,
      visible: true,
      editable: true
    },
    {
      key: 'name',
      title: 'Name',
      dataType: 'varchar',
      format: { type: 'text' },
      editType: 'text',
      width: '200px',
      align: 'left',
      sortable: true,
      filterable: true,
      visible: true,
      editable: true
    },
    {
      key: 'descr',
      title: 'Descr',
      dataType: 'text',
      format: { type: 'text' },
      editType: 'text',
      width: '150px',
      align: 'left',
      sortable: true,
      filterable: true,
      visible: true,
      editable: true
    },
    {
      key: 'dl__project_stage',
      title: 'Project Stage',              // ✅ Removed dl__ prefix
      dataType: 'varchar',
      format: {
        type: 'badge',
        settingsDatalabel: 'project_stage'
      },
      editType: 'select',                   // ✅ Dropdown
      dataSource: {
        type: 'settings',
        datalabel: 'project_stage'
      },
      width: '150px',
      align: 'center',                      // ✅ Centered
      sortable: true,
      filterable: true,
      visible: true,
      editable: true
    },
    {
      key: 'manager_employee_id',
      title: 'Manager Employee',            // ✅ Removed _id suffix
      dataType: 'uuid',
      format: {
        type: 'reference',
        entityType: 'employee'
      },
      editType: 'text',
      width: '150px',
      align: 'left',
      sortable: true,
      filterable: true,
      visible: false,                       // ✅ ID fields hidden
      editable: true
    },
    {
      key: 'budget_allocated_amt',
      title: 'Budget Allocated',            // ✅ Removed _amt suffix
      dataType: 'numeric',
      format: { type: 'currency' },         // ✅ Currency format
      editType: 'number',
      width: '120px',
      align: 'right',                       // ✅ Right-aligned
      sortable: true,
      filterable: true,
      visible: true,
      editable: true
    },
    {
      key: 'start_date',
      title: 'Start Date',
      dataType: 'date',
      format: {
        type: 'date',
        dateFormat: 'MMM DD, YYYY'
      },
      editType: 'date',                     // ✅ Date picker
      width: '120px',
      align: 'left',
      sortable: true,
      filterable: true,
      visible: true,
      editable: true
    },
    {
      key: 'completion_pct',
      title: 'Completion',                  // ✅ Removed _pct suffix
      dataType: 'numeric',
      format: { type: 'percentage' },       // ✅ Percentage format
      editType: 'number',
      width: '100px',
      align: 'right',
      sortable: true,
      filterable: true,
      visible: true,
      editable: true
    },
    {
      key: 'active_flag',
      title: 'Active Flag',
      dataType: 'boolean',
      format: { type: 'boolean' },          // ✅ Boolean badge
      editType: 'boolean',                  // ✅ Checkbox
      width: '100px',
      align: 'center',
      sortable: true,
      filterable: true,
      visible: true,
      editable: true
    },
    {
      key: 'tags',
      title: 'Tags',
      dataType: 'ARRAY',
      format: { type: 'tags' },             // ✅ Tag list
      editType: 'tags',
      width: '150px',
      align: 'left',
      sortable: false,                      // ✅ Arrays not sortable
      filterable: true,
      visible: true,
      editable: true
    },
    {
      key: 'updated_ts',
      title: 'Updated',                     // ✅ Removed _ts suffix
      dataType: 'timestamp with time zone',
      format: { type: 'relative-time' },    // ✅ "2 hours ago"
      editType: 'date',
      width: '150px',
      align: 'left',
      sortable: true,
      filterable: true,
      visible: true,
      editable: false                       // ✅ System field readonly
    }
    // created_ts hidden by SYSTEM_FIELDS filter
  ]
}
```

---

## Frontend Rendering

### Display Mode (schemaFormatters.tsx)

```typescript
import { formatFieldValue } from './schemaFormatters';

// Auto-formats based on column.format.type
const formatted = formatFieldValue(50000, column);
// column.format.type === 'currency' → "$50,000.00"
// column.format.type === 'percentage' → "75.0%"
// column.format.type === 'date' → "Jan 15, 2025"
// column.format.type === 'badge' → 🟢 "In Progress"
```

### Edit Mode (EntityDataTable.tsx)

```typescript
// Auto-renders input based on column.editType
editType === 'number'   → <input type="number" />
editType === 'date'     → <input type="date" />
editType === 'select'   → <select> (populated from dataSource)
editType === 'boolean'  → <input type="checkbox" />
editType === 'tags'     → <TagInput />
editType === 'readonly' → <div> (display only)
```

---

## Benefits of Universal Service

### 1. Zero Configuration

```typescript
// NO manual column definitions needed!
// Just specify entity type and table name
const schema = await buildEntitySchema(db, 'project', 'd_project');
```

### 2. Consistent Behavior

All `*_amt` fields behave the same:
- Right-aligned
- Currency formatted
- 120px width
- Number input
- Sortable & filterable

### 3. Convention Over Configuration

Database schema defines everything:
```sql
budget_allocated_amt NUMERIC  → Auto-detects as currency
dl__project_stage VARCHAR     → Auto-detects as dropdown
updated_ts TIMESTAMP          → Auto-detects as relative time
```

### 4. Maintainability

Add new field? No frontend code changes needed:
```sql
ALTER TABLE d_project ADD COLUMN estimated_cost_amt NUMERIC;
-- Frontend automatically knows:
--   - Display: $X,XXX.XX
--   - Input: <input type="number">
--   - Label: "Estimated Cost"
--   - Alignment: right
--   - Width: 120px
```

---

## Summary

**ONE SERVICE** (`schema-builder.service.ts`) determines EVERYTHING:

| Input | Determines | Example |
|-------|------------|---------|
| `budget_allocated_amt NUMERIC` | Label: "Budget Allocated" | ✅ |
| | Format: Currency ($50,000.00) | ✅ |
| | Input: `<input type="number">` | ✅ |
| | Alignment: Right | ✅ |
| | Width: 120px | ✅ |
| | Sortable: Yes | ✅ |
| | Filterable: Yes | ✅ |
| `dl__project_stage VARCHAR` | Label: "Project Stage" | ✅ |
| | Format: Badge (🟢 "In Progress") | ✅ |
| | Input: `<select>` | ✅ |
| | Data Source: Settings API | ✅ |
| | Alignment: Center | ✅ |
| | Width: 150px | ✅ |
| `updated_ts TIMESTAMP` | Label: "Updated" | ✅ |
| | Format: Relative ("2 hours ago") | ✅ |
| | Input: Date picker | ✅ |
| | Editable: No (system field) | ✅ |
| | Width: 150px | ✅ |

**Result**: Add a database column → Frontend automatically knows how to display, edit, sort, filter, and style it! 🎉
