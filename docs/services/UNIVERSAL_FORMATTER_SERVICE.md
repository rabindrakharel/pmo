# Universal Formatter Service

> **Single source of truth for ALL formatting across the application - Convention over Configuration**

## Overview

The Universal Formatter Service is a **local, zero-API frontend service** that consolidates ALL formatting concerns into one place. It uses **convention over configuration** - column names automatically determine format types, requiring zero manual configuration.

**Location**: `apps/web/src/lib/universalFormatterService.ts` (1182 lines)

### Key Principles

- ✅ **Convention over Configuration** - Column name + data type → complete format spec
- ✅ **Zero API Calls** - Everything is local logic (except badge colors which are cached)
- ✅ **Single Import** - One service for all formatting needs
- ✅ **DRY Principle** - Change format once, applies everywhere
- ✅ **Type-Safe** - Full TypeScript support

## 5 Functional Areas

| Area | Functions | Purpose |
|------|-----------|---------|
| **1. Format Detection** | `detectFieldFormat()`, `generateFieldLabel()`, `getEditType()` | Auto-detect format from column name + data type |
| **2. Value Formatting** | `formatCurrency()`, `formatRelativeTime()`, `formatFieldValue()` | Format values to strings |
| **3. React Rendering** | `renderFieldDisplay()`, `formatBooleanBadge()`, `formatTagsList()` | Render values as React elements |
| **4. Badge Rendering** | `renderSettingBadge()`, `renderBadge()` | Render colored badges from settings |
| **5. Field Capability** | `getFieldCapability()`, `isInvisibleField()` | Determine editability, visibility |

## Naming Conventions (Auto-Detection)

### Currency Fields

**Pattern**: `*_amt`, `*_price`, `*_cost`, `budget_*`, `revenue_*`, `expense_*`

```typescript
detectFieldFormat('budget_allocated_amt', 'numeric')
// Returns: {
//   type: 'currency',
//   label: 'Budget Allocated',
//   width: '120px',
//   align: 'right',
//   editType: 'number'
// }

formatFieldValue(50000, 'currency')
// Returns: "$50,000.00"
```

### Settings/Datalabel Fields

**Pattern**: `dl__*`

```typescript
detectFieldFormat('dl__project_stage', 'varchar')
// Returns: {
//   type: 'badge',
//   label: 'Project Stage',
//   editType: 'select',
//   settingsDatalabel: 'project_stage'
// }

renderFieldDisplay('planning', { type: 'badge', settingsDatalabel: 'project_stage' })
// Returns: <span class="badge badge-blue">Planning</span>
```

### Boolean Fields

**Pattern**: `*_flag`, `is_*`, `has_*`, `can_*`

```typescript
detectFieldFormat('active_flag', 'boolean')
// Returns: {
//   type: 'boolean',
//   editType: 'boolean',
//   align: 'center'
// }

formatBooleanBadge(true, true)
// Returns: <span class="badge badge-green">Active</span>
```

### Date Fields

**Pattern**: `*_date`

```typescript
detectFieldFormat('planned_start_date', 'date')
// Returns: {
//   type: 'date',
//   editType: 'date',
//   dateFormat: 'MMM DD, YYYY'
// }

formatFieldValue('2025-01-15', 'date')
// Returns: "Jan 15, 2025"
```

### Timestamp Fields

**Pattern**: `*_ts`, `*_at`

```typescript
// System timestamps (created_ts, updated_ts) → relative time
detectFieldFormat('created_ts', 'timestamp with time zone')
// Returns: {
//   type: 'relative-time',
//   editType: 'readonly'
// }

formatRelativeTime('2025-01-15T10:30:00Z')
// Returns: "2 hours ago"

// Other timestamps → datetime
detectFieldFormat('scheduled_at', 'timestamp with time zone')
// Returns: {
//   type: 'datetime',
//   editType: 'date'
// }
```

### Tag/Array Fields

**Pattern**: `tags`, `*_tags`, data type `ARRAY`

```typescript
detectFieldFormat('tags', 'ARRAY')
// Returns: {
//   type: 'tags',
//   editType: 'tags'
// }

formatTagsList(['tag1', 'tag2', 'tag3'])
// Returns: <span><badge>tag1</badge> <badge>tag2</badge> ...</span>
```

### Reference Fields

**Pattern**: `*_id` (with uuid data type)

```typescript
detectFieldFormat('manager_employee_id', 'uuid')
// Returns: {
//   type: 'reference',
//   editType: 'text',
//   entityType: 'employee'
// }

formatReference({ id: '123', name: 'John Doe' }, 'employee')
// Returns: <a href="/employee/123">John Doe</a>
```

### Percentage Fields

**Pattern**: `*_pct`, `*_percentage`, `*_rate`

```typescript
detectFieldFormat('completion_pct', 'numeric')
// Returns: {
//   type: 'percentage',
//   align: 'right',
//   editType: 'number'
// }

formatFieldValue(75.5, 'percentage')
// Returns: "75.5%"
```

### Numeric Fields

**Pattern**: `*_count`, `*_qty`, `*_quantity`, `*_level`, `*_order`

```typescript
detectFieldFormat('task_count', 'integer')
// Returns: {
//   type: 'number',
//   align: 'right',
//   editType: 'number'
// }
```

## Complete Auto-Detection Pattern Table

| Pattern | Format Type | Example Column | Display Example |
|---------|-------------|----------------|-----------------|
| `*_amt`, `*_price`, `*_cost` | `currency` | `budget_allocated_amt` | `$50,000.00` |
| `dl__*` | `badge` | `dl__project_stage` | 🟢 `Planning` |
| `*_flag`, `is_*`, `has_*` | `boolean` | `active_flag` | 🟢 `Active` |
| `*_date` | `date` | `planned_start_date` | `Jan 15, 2025` |
| `created_ts`, `updated_ts` | `relative-time` | `created_ts` | `2 hours ago` |
| Other `*_ts`, `*_at` | `datetime` | `scheduled_at` | `Jan 15, 2025, 2:30 PM` |
| `tags`, `*_tags`, `ARRAY` | `tags` | `tags` | `tag1` `tag2` `tag3` |
| `*_id` (uuid) | `reference` | `manager_employee_id` | Link to employee |
| `*_pct`, `*_rate` | `percentage` | `completion_pct` | `75.0%` |
| `*_count`, `*_qty` | `number` | `task_count` | `42` |
| Default | `text` | `name`, `description` | Plain text |

## Usage Examples

### 1. Auto-Detect Format from Column

```typescript
import { detectFieldFormat } from '@/lib/universalFormatterService';

// Example: budget_allocated_amt column
const format = detectFieldFormat('budget_allocated_amt', 'numeric');
// Result: {
//   type: 'currency',
//   label: 'Budget Allocated',
//   width: '120px',
//   align: 'right',
//   sortable: true,
//   filterable: true,
//   editable: true,
//   editType: 'number'
// }
```

### 2. Format Value for Display

```typescript
import { formatFieldValue } from '@/lib/universalFormatterService';

// Currency
formatFieldValue(50000, 'currency');          // "$50,000.00"

// Date
formatFieldValue('2025-01-15', 'date');        // "Jan 15, 2025"

// Relative time
formatFieldValue('2025-01-15T10:30:00Z', 'relative-time');  // "2 hours ago"

// Percentage
formatFieldValue(75.5, 'percentage');          // "75.5%"

// Boolean
formatFieldValue(true, 'boolean');             // "Yes"

// Tags
formatFieldValue(['tag1', 'tag2'], 'tags');    // "tag1, tag2"
```

### 3. Render as React Element

```typescript
import { renderFieldDisplay } from '@/lib/universalFormatterService';

// Currency with styling
const currencyElement = renderFieldDisplay(50000, { type: 'currency' });
// <span>$50,000.00</span>

// Badge with color
const badgeElement = renderFieldDisplay('planning', {
  type: 'badge',
  settingsDatalabel: 'project_stage'
});
// <span class="badge badge-blue">Planning</span>

// Boolean badge
const boolElement = renderFieldDisplay(true, { type: 'boolean' });
// <span class="badge badge-green">Active</span>

// Tags list
const tagsElement = renderFieldDisplay(['tag1', 'tag2', 'tag3'], { type: 'tags' });
// <span><badge>tag1</badge> <badge>tag2</badge> <badge>tag3</badge></span>
```

### 4. Render Settings Badge

```typescript
import { renderSettingBadge, loadSettingsColors } from '@/lib/universalFormatterService';

// Preload colors from API (cached)
await loadSettingsColors('project_stage');

// Render badge with database color
const badge = renderSettingBadge('blue', 'Planning');
// <span class="badge bg-blue-100 text-blue-800">Planning</span>

// OR use datalabel-based lookup
const badge2 = renderSettingBadge('Planning', { datalabel: 'project_stage' });
// Auto-fetches color from cache, renders with correct color
```

### 5. Generate Field Label

```typescript
import { generateFieldLabel } from '@/lib/universalFormatterService';

generateFieldLabel('budget_allocated_amt');    // "Budget Allocated"
generateFieldLabel('dl__project_stage');       // "Project Stage"
generateFieldLabel('manager_employee_id');     // "Manager Employee"
generateFieldLabel('updated_ts');              // "Updated"
generateFieldLabel('active_flag');             // "Active"
```

### 6. Get Edit Type

```typescript
import { getEditType } from '@/lib/universalFormatterService';

getEditType('budget_allocated_amt', 'numeric');     // "number"
getEditType('dl__project_stage', 'varchar');        // "select"
getEditType('active_flag', 'boolean');              // "boolean"
getEditType('planned_start_date', 'date');          // "date"
getEditType('tags', 'ARRAY');                       // "tags"
getEditType('attachment', 'varchar');               // "file"
getEditType('name', 'varchar');                     // "text"
```

## Field Capability Detection

### Readonly Fields

Automatically readonly (cannot be edited):

- `id`
- `created_ts`, `updated_ts`
- `created_by`, `updated_by`
- `from_ts`, `to_ts`
- `parent_id`, `parent_type`, `parent_name`
- `child_count`
- `version`
- `total_*`, `sum_*`, `avg_*`, `max_*`, `min_*` (computed fields)

### Invisible Fields

Hidden from UI by default:

- All `*_id` fields (except `id`)
- `metadata` field

### File Upload Fields

Auto-detected from column name:

- `attachment`
- `attachment_object_key`
- `*_file`
- `*_document`

## Badge Color System

### Color Mapping

Database `color_code` → Tailwind CSS classes:

```typescript
const COLOR_MAP = {
  'blue': 'bg-dark-100 text-dark-600 border border-dark-400',
  'purple': 'bg-purple-100 text-purple-800 border border-purple-200',
  'green': 'bg-green-100 text-green-800 border border-green-200',
  'red': 'bg-red-100 text-red-800 border border-red-200',
  'yellow': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  'orange': 'bg-orange-100 text-orange-800 border border-orange-200',
  'gray': 'bg-dark-100 text-dark-600 border border-dark-300',
  'cyan': 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  'pink': 'bg-pink-100 text-pink-800 border border-pink-200',
  'amber': 'bg-amber-100 text-amber-800 border border-amber-200'
};
```

### Color Cache

Settings colors are cached to avoid repeated API calls:

```typescript
// Preload colors for multiple datalabels
await preloadSettingsColors(['project_stage', 'task_priority', 'task_stage']);

// Colors are cached and reused across all renders
```

## Integration with Components

### EntityDataTable

```typescript
import { detectFieldFormat, renderFieldDisplay } from '@/lib/universalFormatterService';

// Auto-detect all column formats
const columns = dbColumns.map(col => {
  const format = detectFieldFormat(col.name, col.dataType);
  return {
    ...format,
    // Use renderFieldDisplay for cell rendering
    render: (value) => renderFieldDisplay(value, format)
  };
});
```

### EntityFormContainer

```typescript
import { detectFieldFormat, getEditType } from '@/lib/universalFormatterService';

// Auto-detect field edit types
const fields = dbColumns.map(col => {
  const editType = getEditType(col.name, col.dataType);
  const label = generateFieldLabel(col.name);
  return { name: col.name, editType, label };
});
```

### FilteredDataTable

```typescript
import { formatFieldValue } from '@/lib/universalFormatterService';

// Format filter values
const formattedValue = formatFieldValue(filterValue, columnFormat.type);
```

## Benefits

### Before (Without Service)

```typescript
// CURRENCY: Manual formatting in every component
const formatted = `$${Number(value).toFixed(2)}`;

// DATE: Inconsistent date formatting
const date1 = new Date(value).toLocaleDateString();
const date2 = moment(value).format('MMM DD, YYYY');
const date3 = value.substring(0, 10);

// BADGE: Manual badge rendering
<span className="px-2 py-1 rounded bg-blue-100 text-blue-800">
  {value}
</span>

// RESULT: 50+ different formatting implementations across codebase
```

### After (With Service)

```typescript
import {
  detectFieldFormat,
  formatFieldValue,
  renderFieldDisplay
} from '@/lib/universalFormatterService';

// Auto-detect format
const format = detectFieldFormat('budget_allocated_amt', 'numeric');

// Format value
const formatted = formatFieldValue(value, format.type);

// OR render as React element
const element = renderFieldDisplay(value, format);

// RESULT: Single source of truth, 100% consistency
```

## TypeScript Types

```typescript
export type FormatType =
  | 'text' | 'currency' | 'number' | 'percentage'
  | 'date' | 'datetime' | 'relative-time'
  | 'badge' | 'tags' | 'reference' | 'boolean';

export type EditType =
  | 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time'
  | 'select' | 'multiselect' | 'checkbox' | 'boolean'
  | 'textarea' | 'tags' | 'jsonb' | 'datatable' | 'file'
  | 'dag-select' | 'readonly';

export interface FieldFormat {
  type: FormatType;
  label: string;
  width: string;
  align: 'left' | 'center' | 'right';
  sortable: boolean;
  filterable: boolean;
  editable: boolean;
  editType: EditType;
  settingsDatalabel?: string;
  entityType?: string;
  dateFormat?: string;
}
```

## Configuration Files

### Locale Configuration

**Location**: `apps/web/src/lib/config/locale.ts`

```typescript
export const formatters = {
  currency: (value: number) => new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(value),

  number: (value: number) => new Intl.NumberFormat('en-CA').format(value),

  percentage: (value: number) => `${value}%`,

  date: (value: string) => new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }),

  datetime: (value: string) => new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
};
```

### Display Configuration

**Location**: `apps/web/src/lib/config/display.ts`

```typescript
export const DISPLAY_CONFIG = {
  MAX_TAGS_DISPLAY: 3,
  MAX_TEXT_LENGTH: 100
};
```

## Anti-Patterns (Avoid)

❌ **Manual formatting in components**:
```typescript
// WRONG - Manual formatting
const formatted = `$${Number(value).toFixed(2)}`;
```

❌ **Hardcoded badge colors**:
```typescript
// WRONG - Hardcoded colors
<span className="bg-blue-100 text-blue-800">{value}</span>
```

❌ **Inconsistent date formatting**:
```typescript
// WRONG - Different formats in different places
const date1 = moment(value).format('MM/DD/YYYY');
const date2 = new Date(value).toLocaleDateString();
```

❌ **Duplicate format detection logic**:
```typescript
// WRONG - Reimplementing detection
if (columnName.endsWith('_amt')) {
  // format as currency
}
```

## Related Documentation

- **Implementation**: `apps/web/src/lib/universalFormatterService.ts`
- **Locale Config**: `apps/web/src/lib/config/locale.ts`
- **Display Config**: `apps/web/src/lib/config/display.ts`
- **Component Integration**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

## Version History

- **v1.0.0** (2025-01-17) - Initial implementation (1182 lines)
- **Pattern**: Convention over Configuration
- **Coverage**: 100% of frontend formatting needs
