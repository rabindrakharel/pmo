# Universal Formatter Service V2.0 - Complete Consolidation

**File**: `apps/web/src/lib/universalFormatterService.ts`

## 🎯 ONE Service for Everything

**No more scattered code!** Everything formatting-related is now in **ONE place**:

```
universalFormatterService.ts (1000+ LOC)
├── Naming Convention Detection  (column name → format type)
├── Value Formatters             (format type → formatted string)
├── React Element Rendering      (value → React component)
├── Badge Rendering              (settings → colored badges)
├── Data Transformation          (API ↔ Frontend)
└── Field Capability Detection   (editable vs readonly)
```

**Behaves like a service** - Everything is LOCAL, NO API calls needed for formatting logic!

---

## 🚀 How It Works

### Input → Output

```typescript
import {
  detectFieldFormat,
  formatFieldValue,
  renderFieldDisplay
} from './universalFormatterService';

// 1. Column Name + Data Type → Complete Field Format
const format = detectFieldFormat('budget_allocated_amt', 'numeric');

// Returns EVERYTHING in one call:
{
  type: 'currency',              // ✅ Format type
  label: 'Budget Allocated',     // ✅ Human-readable label
  width: '120px',                // ✅ Column width
  align: 'right',                // ✅ Text alignment
  sortable: true,                // ✅ Can be sorted
  filterable: true,              // ✅ Can be filtered
  editable: true,                // ✅ Can be edited
  editType: 'number'             // ✅ Input type for editing
}

// 2. Value + Format Type → Formatted String
const formatted = formatFieldValue(50000, 'currency');
// Returns: "$50,000.00"

// 3. Value + Format → React Element
const element = renderFieldDisplay(50000, { type: 'currency' });
// Returns: <span>$50,000.00</span>
```

---

## 📋 Complete API Reference

### 1. Format Detection

#### `detectFieldFormat(columnName, dataType)`
**Detects EVERYTHING from column name and data type**

```typescript
// Example 1: Currency field
detectFieldFormat('budget_allocated_amt', 'numeric')
→ {
    type: 'currency',
    label: 'Budget Allocated',
    width: '120px',
    align: 'right',
    editType: 'number',
    sortable: true,
    filterable: true,
    editable: true
  }

// Example 2: Settings field
detectFieldFormat('dl__project_stage', 'varchar')
→ {
    type: 'badge',
    label: 'Project Stage',
    width: '150px',
    align: 'center',
    editType: 'select',
    settingsDatalabel: 'project_stage',
    sortable: true,
    filterable: true,
    editable: true
  }

// Example 3: Timestamp field
detectFieldFormat('updated_ts', 'timestamp with time zone')
→ {
    type: 'relative-time',
    label: 'Updated',
    width: '150px',
    align: 'left',
    editType: 'readonly',
    sortable: true,
    filterable: true,
    editable: false
  }

// Example 4: Boolean field
detectFieldFormat('active_flag', 'boolean')
→ {
    type: 'boolean',
    label: 'Active',
    width: '100px',
    align: 'center',
    editType: 'boolean',
    sortable: true,
    filterable: true,
    editable: true
  }
```

#### `generateFieldLabel(columnName)`
**Converts column name to human-readable label**

```typescript
generateFieldLabel('budget_allocated_amt')  → 'Budget Allocated'
generateFieldLabel('dl__project_stage')     → 'Project Stage'
generateFieldLabel('updated_ts')            → 'Updated'
generateFieldLabel('is_active')             → 'Is Active'
```

#### `getEditType(columnName, dataType)`
**Determines input type for editing**

```typescript
getEditType('budget_allocated_amt', 'numeric')  → 'number'
getEditType('dl__project_stage', 'varchar')     → 'select'
getEditType('start_date', 'date')               → 'date'
getEditType('active_flag', 'boolean')           → 'boolean'
getEditType('tags', 'ARRAY')                    → 'tags'
getEditType('created_ts', 'timestamp')          → 'readonly'
```

---

### 2. Value Formatting

#### `formatFieldValue(value, formatType)`
**Formats value based on format type - returns STRING**

```typescript
formatFieldValue(50000, 'currency')             → "$50,000.00"
formatFieldValue(1234, 'number')                → "1,234"
formatFieldValue(0.75, 'percentage')            → "75.0%"
formatFieldValue('2025-01-15', 'date')          → "Jan 15, 2025"
formatFieldValue('2025-01-15T14:30:00Z', 'datetime')
  → "Jan 15, 2025, 2:30 PM"
formatFieldValue('2025-01-15T12:00:00Z', 'relative-time')
  → "2 hours ago"
formatFieldValue(true, 'boolean')               → "Yes"
formatFieldValue(['tag1', 'tag2'], 'tags')      → "tag1, tag2"
```

#### `formatCurrency(value, currency?)`
**Format currency with locale-specific formatting**

```typescript
formatCurrency(50000)           → "$50,000.00"
formatCurrency(1234.56)         → "$1,234.56"
formatCurrency(null)            → "—"
formatCurrency(50000, 'USD')    → "$50,000.00"
```

#### `formatRelativeTime(dateString)`
**Format timestamp as relative time**

```typescript
formatRelativeTime('2025-01-15T12:00:00Z')  → "2 hours ago"
formatRelativeTime('2025-01-14T12:00:00Z')  → "1 day ago"
formatRelativeTime('2025-01-01T12:00:00Z')  → "15 days ago"
formatRelativeTime(new Date())              → "just now"
```

#### `formatFriendlyDate(dateString)`
**Format date in friendly format**

```typescript
formatFriendlyDate('2025-01-15')          → "Jan 15, 2025"
formatFriendlyDate('2025-12-25')          → "Dec 25, 2025"
formatFriendlyDate(new Date())            → "Jan 16, 2025"
```

#### `isCurrencyField(key)`
**Check if field is a currency field**

```typescript
isCurrencyField('budget_allocated_amt')   → true
isCurrencyField('total_cost')             → true
isCurrencyField('revenue_forecast')       → true
isCurrencyField('name')                   → false
```

---

### 3. React Element Rendering

#### `renderFieldDisplay(value, format)`
**Renders value as React element with proper styling**

```typescript
// Currency
renderFieldDisplay(50000, { type: 'currency' })
→ <span>$50,000.00</span>

// Badge (settings field)
renderFieldDisplay('In Progress', { type: 'badge', settingsDatalabel: 'project_stage' })
→ <span className="...purple-badge...">In Progress</span>

// Boolean
renderFieldDisplay(true, { type: 'boolean' })
→ <span className="...green-badge...">Active</span>

// Tags
renderFieldDisplay(['tag1', 'tag2', 'tag3'], { type: 'tags' })
→ <span>
    <span className="...">tag1</span>
    <span className="...">tag2</span>
    <span className="...">tag3</span>
  </span>

// Reference (link to entity)
renderFieldDisplay({ id: 'uuid', name: 'John Doe' }, { type: 'reference', entityType: 'employee' })
→ <a href="/employee/uuid">John Doe</a>
```

#### `renderSettingBadge(colorCode, label, size?)`
**Render colored badge for settings values**

```typescript
// MODE 1: Direct color code
renderSettingBadge('purple', 'In Progress')
→ <span className="...purple-badge...">In Progress</span>

// MODE 2: Datalabel-based lookup
renderSettingBadge('In Progress', { datalabel: 'project_stage' })
→ <span className="...purple-badge...">In Progress</span>
  (color looked up from cache: 'In Progress' → 'purple')

// With size
renderSettingBadge('green', 'Active', 'md')
→ <span className="...green-badge... px-3.5 py-1.5 text-sm">Active</span>
```

#### `renderBadge(label, variant, size?)`
**Render plain badge without color lookup**

```typescript
renderBadge('Active', 'success')        → <span className="...green...">Active</span>
renderBadge('Pending', 'warning')       → <span className="...yellow...">Pending</span>
renderBadge('Error', 'danger')          → <span className="...red...">Error</span>
renderBadge('Info', 'info', 'sm')       → <span className="...cyan... px-3 py-1">Info</span>
```

---

### 4. Badge Color Management

#### `loadSettingsColors(datalabel)`
**Load colors for a settings datalabel from API**

```typescript
// Load colors once
await loadSettingsColors('project_stage');

// Now getSettingColor() will work
const color = getSettingColor('project_stage', 'Planning');  → 'purple'
```

#### `getSettingColor(datalabel, value)`
**Get color code for a settings value**

```typescript
// Must call loadSettingsColors() first!
getSettingColor('project_stage', 'Planning')      → 'purple'
getSettingColor('project_stage', 'Execution')     → 'yellow'
getSettingColor('task_priority', 'High')          → 'red'
getSettingColor('task_priority', 'Low')           → 'green'
```

#### `preloadSettingsColors(datalabels)`
**Batch load colors on page mount**

```typescript
// Load multiple settings at once
await preloadSettingsColors([
  'project_stage',
  'task_stage',
  'task_priority',
  'employee_status'
]);

// Now all getSettingColor() calls will work immediately
```

---

### 5. Data Transformation

#### `transformForApi(data, originalRecord?)`
**Transform edited data before sending to API**

```typescript
const editedData = {
  start_date: '2025-01-15T00:00:00.000Z',  // ISO timestamp
  tags: 'tag1, tag2, tag3',                // Comma-separated string
  description: ''                           // Empty string
};

const apiData = transformForApi(editedData);

// Result:
{
  start_date: '2025-01-15',               // ✅ Converted to yyyy-MM-dd
  tags: ['tag1', 'tag2', 'tag3'],         // ✅ Converted to array
  description: null                        // ✅ Empty string → null
}
```

#### `transformFromApi(data)`
**Transform API data for form editing**

```typescript
const apiData = {
  tags: ['tag1', 'tag2', 'tag3'],         // Array
  categories: ['cat1', 'cat2']             // Array
};

const formData = transformFromApi(apiData);

// Result:
{
  tags: 'tag1, tag2, tag3',               // ✅ Array → comma-separated
  categories: 'cat1, cat2'                 // ✅ Array → comma-separated
}
```

#### `transformArrayField(value)`
**Transform array field from string to array**

```typescript
transformArrayField('tag1, tag2, tag3')   → ['tag1', 'tag2', 'tag3']
transformArrayField(['tag1', 'tag2'])     → ['tag1', 'tag2']
transformArrayField('')                   → []
```

#### `transformDateField(value)`
**Transform date to yyyy-MM-dd format**

```typescript
transformDateField('2025-01-15T00:00:00.000Z')  → '2025-01-15'
transformDateField('2025-01-15')                → '2025-01-15'
transformDateField(new Date('2025-01-15'))      → '2025-01-15'
transformDateField(null)                        → null
```

---

### 6. Field Capability Detection

#### `getFieldCapability(columnKey, dataType?)`
**Determine if field is editable and what edit type to use**

```typescript
// Readonly field
getFieldCapability('created_ts')
→ { inlineEditable: false, editType: 'readonly', isFileUpload: false }

// Number field
getFieldCapability('budget_allocated_amt', 'numeric')
→ { inlineEditable: true, editType: 'number', isFileUpload: false }

// Settings field
getFieldCapability('dl__project_stage')
→ {
    inlineEditable: true,
    editType: 'select',
    loadOptionsFromSettings: true,
    settingsDatalabel: 'project_stage',
    isFileUpload: false
  }

// File field
getFieldCapability('attachment')
→ {
    inlineEditable: true,
    editType: 'file',
    isFileUpload: true,
    acceptedFileTypes: '*'
  }

// Boolean field
getFieldCapability('active_flag', 'boolean')
→ { inlineEditable: true, editType: 'boolean', isFileUpload: false }

// Tags field
getFieldCapability('tags', 'ARRAY')
→ { inlineEditable: true, editType: 'tags', isFileUpload: false }
```

---

## 🎨 Naming Convention Rules

The service automatically detects format type from column name:

| Pattern | Format Type | Edit Type | Display Example |
|---------|-------------|-----------|-----------------|
| `*_amt`, `*_price`, `*_cost` | `currency` | `number` | `$50,000.00` |
| `dl__*` | `badge` | `select` | 🟢 "In Progress" |
| `*_ts`, `*_at` (timestamp) | `relative-time` | `readonly` | "2 hours ago" |
| `*_date` | `date` | `date` | "Jan 15, 2025" |
| `timestamp` type | `datetime` | `date` | "Jan 15, 2025, 2:30 PM" |
| `boolean` type | `boolean` | `boolean` | 🟢 "Active" |
| `*_pct`, `*_rate` | `percentage` | `number` | "75.0%" |
| `*_id` (uuid) | `reference` | `text` | Link to entity |
| `tags` or `ARRAY` | `tags` | `tags` | `tag1` `tag2` |
| `integer`, `numeric` | `number` | `number` | "1,234" |
| Default | `text` | `text` | Plain text |

---

## 💡 Usage Examples

### Example 1: Simple Value Formatting

```typescript
import { detectFieldFormat, formatFieldValue } from './universalFormatterService';

// Detect format
const format = detectFieldFormat('budget_allocated_amt', 'numeric');
console.log(format.label);  // "Budget Allocated"
console.log(format.type);   // "currency"

// Format value
const formatted = formatFieldValue(50000, format.type);
console.log(formatted);     // "$50,000.00"
```

### Example 2: React Component Rendering

```typescript
import { renderFieldDisplay } from './universalFormatterService';

function ProjectRow({ project }) {
  return (
    <tr>
      <td>{project.name}</td>
      <td>{renderFieldDisplay(project.budget_allocated_amt, { type: 'currency' })}</td>
      <td>{renderFieldDisplay(project.dl__project_stage, {
        type: 'badge',
        settingsDatalabel: 'project_stage'
      })}</td>
      <td>{renderFieldDisplay(project.updated_ts, { type: 'relative-time' })}</td>
    </tr>
  );
}
```

### Example 3: Complete Table Column Generation

```typescript
import { detectFieldFormat } from './universalFormatterService';

// Columns from database introspection
const dbColumns = [
  { name: 'code', dataType: 'varchar' },
  { name: 'name', dataType: 'varchar' },
  { name: 'budget_allocated_amt', dataType: 'numeric' },
  { name: 'dl__project_stage', dataType: 'varchar' },
  { name: 'updated_ts', dataType: 'timestamp with time zone' }
];

// Auto-generate column configs
const columns = dbColumns.map(col => {
  const format = detectFieldFormat(col.name, col.dataType);
  return {
    key: col.name,
    title: format.label,
    width: format.width,
    align: format.align,
    sortable: format.sortable,
    filterable: format.filterable,
    render: (value) => renderFieldDisplay(value, format)
  };
});

// Result: Fully configured columns with zero manual configuration!
```

### Example 4: Form Data Transformation

```typescript
import { transformForApi, transformFromApi } from './universalFormatterService';

// When loading form from API
const apiData = await fetch('/api/v1/project/123').then(r => r.json());
const formData = transformFromApi(apiData);
// Arrays → comma-separated strings for form inputs

// When saving form to API
const editedFormData = { ...formData, start_date: '2025-01-15', tags: 'tag1, tag2' };
const apiPayload = transformForApi(editedFormData);
// Dates → yyyy-MM-dd, tags → array, empty strings → null
```

### Example 5: Preloading Badge Colors

```typescript
import { preloadSettingsColors, renderSettingBadge } from './universalFormatterService';

function ProjectTable() {
  useEffect(() => {
    // Preload colors on mount
    preloadSettingsColors([
      'project_stage',
      'task_priority',
      'employee_status'
    ]);
  }, []);

  return (
    <table>
      {projects.map(project => (
        <tr key={project.id}>
          <td>{project.name}</td>
          <td>{renderSettingBadge(project.dl__project_stage, {
            datalabel: 'project_stage'
          })}</td>
        </tr>
      ))}
    </table>
  );
}
```

---

## ✅ Benefits

### 1. Single Import
```typescript
// Before: Multiple imports from different files
import { formatCurrency } from './data_transform_render';
import { formatters } from './config/locale';
import { renderSettingBadge } from './data_transform_render';
import { detectFieldFormat } from './schemaFormatters';

// After: ONE import for everything
import {
  detectFieldFormat,
  formatCurrency,
  renderSettingBadge,
  renderFieldDisplay
} from './universalFormatterService';
```

### 2. No API Calls for Formatting Logic
```typescript
// Everything is LOCAL - no API calls needed!
const format = detectFieldFormat('budget_allocated_amt', 'numeric');
const formatted = formatFieldValue(50000, 'currency');
const element = renderFieldDisplay(50000, { type: 'currency' });

// Only ONE API call for badge colors (optional, cached)
await loadSettingsColors('project_stage');
```

### 3. Convention Over Configuration
```typescript
// Add new column to database
ALTER TABLE d_project ADD COLUMN estimated_revenue_amt NUMERIC;

// Frontend automatically knows:
const format = detectFieldFormat('estimated_revenue_amt', 'numeric');
// → type: 'currency', label: 'Estimated Revenue', editType: 'number', etc.

// Zero configuration needed!
```

### 4. DRY Principle
```typescript
// ONE place defines all formatting rules
// Change currency format? Update formatCurrency() once
// Change badge colors? Update COLOR_MAP once
// Add new field pattern? Update FIELD_PATTERNS once

// All components automatically use the updated logic!
```

### 5. Type Safety
```typescript
// Full TypeScript support
import type { FormatType, EditType, FieldFormat } from './universalFormatterService';

const format: FieldFormat = detectFieldFormat('budget', 'numeric');
const formatted: string = formatFieldValue(50000, 'currency');
const editType: EditType = getEditType('budget', 'numeric');
```

---

## 📊 What's Consolidated

| Functionality | Before | After |
|--------------|--------|-------|
| **Naming Convention Detection** | `schema-builder.service.ts` (backend) | `universalFormatterService.ts` ✅ |
| **Value Formatters** | `data_transform_render.tsx` | `universalFormatterService.ts` ✅ |
| **Badge Rendering** | `data_transform_render.tsx` | `universalFormatterService.ts` ✅ |
| **Data Transformation** | `data_transform_render.tsx` | `universalFormatterService.ts` ✅ |
| **Field Capability** | `data_transform_render.tsx` | `universalFormatterService.ts` ✅ |
| **React Rendering** | `schemaFormatters.tsx` | `universalFormatterService.ts` ✅ |
| **Locale Formatters** | `config/locale.ts` | Imported and used ✅ |

**Result**: ONE service handles ALL formatting concerns! 🎉

---

## 🚀 Migration Path

### Old Way (Scattered)
```typescript
// Multiple imports
import { formatCurrency } from './data_transform_render';
import { detectFieldFormat } from './schema-builder.service';
import { renderSettingBadge } from './data_transform_render';

// Multiple steps
const format = detectFieldFormat(columnName, dataType);
const formatted = formatCurrency(value);
const badge = renderSettingBadge(colorCode, label);
```

### New Way (Consolidated)
```typescript
// ONE import
import {
  detectFieldFormat,
  formatFieldValue,
  renderFieldDisplay,
  renderSettingBadge
} from './universalFormatterService';

// Same API, all in one place
const format = detectFieldFormat(columnName, dataType);
const formatted = formatFieldValue(value, 'currency');
const element = renderFieldDisplay(value, format);
```

---

## 📖 Summary

**Universal Formatter Service V2.0** consolidates ALL formatting concerns into ONE service:

✅ **1000+ lines** of formatting logic in ONE place
✅ **No API calls** needed for formatting (only for badge colors, cached)
✅ **Convention over configuration** (column name determines everything)
✅ **Zero duplication** (DRY principle)
✅ **Type-safe** (full TypeScript support)
✅ **Single import** for all formatting needs

**ONE service to rule them all!** 🎉
