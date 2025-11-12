# Universal Field Detector - Quick Reference Cheat Sheet

**ONE function for all field metadata** → `universalFieldDetector.ts`

---

## 🚀 Quick Start (Copy-Paste Ready)

### Pattern 1: Auto-Generate Table Columns
```typescript
import { generateDataTableConfig } from '@/lib/viewConfigGenerator';

// Get field keys from API response
const fieldKeys = Object.keys(data[0] || {});

// Generate complete table config (1 line!)
const config = generateDataTableConfig(fieldKeys);

// Use in component
<EntityDataTable
  columns={config.visibleColumns}        // Auto-excludes 'id', hidden fields
  editableColumns={config.editableColumns}
  data={data}
  onEdit={(row) => api.update(row.id, data)}  // row.id still available!
/>
```

### Pattern 2: Auto-Generate Form Fields
```typescript
import { generateFormConfig } from '@/lib/viewConfigGenerator';

const config = generateFormConfig(fieldKeys, {
  requiredFields: ['name', 'code']  // Optional
});

<EntityFormContainer
  fields={config.editableFields}  // Auto-excludes readonly/system fields
  requiredFields={config.requiredFields}
/>
```

### Pattern 3: Auto-Detect Kanban Config
```typescript
import { generateKanbanConfig } from '@/lib/viewConfigGenerator';

const config = generateKanbanConfig(fieldKeys);

if (config) {
  <KanbanBoard
    groupByField={config.groupByField}     // Auto: dl__*_stage > status
    cardFields={config.cardFields}
  />
}
```

### Pattern 4: Auto-Detect DAG Config
```typescript
import { generateDAGConfig } from '@/lib/viewConfigGenerator';

const config = generateDAGConfig(fieldKeys);

if (config) {
  <DAGVisualizer
    stageField={config.stageField}  // Auto: dl__*_stage or dl__*_funnel
    datalabel={config.datalabel}
  />
}
```

### Pattern 5: ONE Call for All Views
```typescript
import { generateViewConfig } from '@/lib/viewConfigGenerator';

// Get everything at once
const viewConfig = generateViewConfig(fieldKeys);

// Access any view's config:
viewConfig.dataTable.visibleColumns
viewConfig.form.editableFields
viewConfig.kanban.groupByField
viewConfig.dag.stageField
```

---

## 📋 12 Obvious Patterns (Auto-Detected)

| Pattern | Example | Auto Output |
|---------|---------|-------------|
| `*_amt`, `*_price`, `*_cost` | `budget_allocated_amt` | $ currency, right-aligned, editType: 'currency' |
| `*_pct`, `*_percent` | `discount_pct` | % percentage, right-aligned, editType: 'text' |
| `*_ts`, `*_at` | `created_ts` | "3 days ago", editType: 'datetime', readonly if system |
| `*_date` | `start_date` | "Mar 15, 2025", editType: 'date' |
| `*_count`, `*_qty`, `*_hours` | `task_count` | Number, right-aligned, editType: 'number' |
| `dl__*_stage`, `dl__*_funnel` | `dl__project_stage` | Badge, editType: 'select', component: DAGVisualizer |
| `is_*`, `has_*`, `*_flag` | `is_active` | ✓/✗ checkbox, editType: 'checkbox' |
| `*_id` (not `id`) | `project_id` | visible: false, auto-gen `project_name` column |
| `name`, `code`, `descr` | `name` | Plain text, searchable, editType: 'text' |
| `metadata`, `attr` | `metadata` | JSONB editor, editType: 'datatable', component: MetadataTable |
| `tags` | `tags` | Tags input, editType: 'tags', array ↔ string transform |
| `id`, `version`, system | `id`, `created_ts` | readonly, id: visible: false |

---

## 🔑 Critical Concepts

### visible: false ≠ "not in data"
```typescript
// 'id' field: visible=false but still in row data
<EntityDataTable
  columns={config.visibleColumns}  // ❌ NO 'id' column shown
  data={apiData}                   // ✅ Has 'id' in row data
  onEdit={(row) => {
    api.update(row.id, data);      // ✅ row.id available for API!
  }}
/>
```

### Auto-Generated Columns
```typescript
// Input: ['project_id', 'assignee_id']
// Output: Hides 'project_id', 'assignee_id'
//         Auto-generates 'project_name', 'assignee_name' (visible=true)
```

### EditType Options (15 types)
```
text, number, currency, date, datetime, time,
select, multiselect, checkbox, textarea,
tags, jsonb, datatable, file, dag-select
```

---

## 🎯 Common Use Cases

### Use Case 1: Simple Table
```typescript
const config = generateDataTableConfig(Object.keys(data[0]));
<DataTable columns={config.visibleColumns} data={data} />
```

### Use Case 2: Table with Inline Editing
```typescript
const config = generateDataTableConfig(fieldKeys);
<EntityDataTable
  columns={config.visibleColumns}
  editableColumns={config.editableColumns}
  inlineEdit={true}
/>
```

### Use Case 3: Form with Required Fields
```typescript
const config = generateFormConfig(fieldKeys, {
  requiredFields: ['name', 'email']
});
<EntityFormContainer fields={config.editableFields} />
```

### Use Case 4: Kanban View
```typescript
const kanban = generateKanbanConfig(fieldKeys);
if (kanban) {
  <KanbanBoard
    groupByField={kanban.groupByField}  // Auto-detects dl__*_stage
    cardFields={kanban.cardFields}      // All visible fields
  />
}
```

---

## 🛠️ Debugging

### Check What Was Detected
```typescript
import { detectField } from '@/lib/universalFieldDetector';

// Debug single field
const meta = detectField('budget_allocated_amt');
console.log(meta.pattern);    // "CURRENCY"
console.log(meta.inputType);  // "currency"
console.log(meta.editType);   // "currency"
console.log(meta.visible);    // true
```

### Override Auto-Detection
```typescript
const config = generateDataTableConfig(fieldKeys);

// Override specific fields
config.columns = config.columns.map(col =>
  col.key === 'name' ? { ...col, width: '300px' } : col
);
```

---

## ⚡ Performance Tips

### Cache Config (Don't Re-Generate on Every Render)
```typescript
// ✅ GOOD: Memoized
const config = useMemo(() =>
  generateDataTableConfig(fieldKeys),
  [fieldKeys]
);

// ❌ BAD: Re-generates on every render
const config = generateDataTableConfig(fieldKeys);
```

### Generate Only What You Need
```typescript
// If only need table config:
const tableConfig = generateDataTableConfig(fieldKeys);

// Don't generate all views if only using one:
const allViews = generateViewConfig(fieldKeys);  // Slower
```

---

## 📦 Import Paths

```typescript
// Core detector
import { detectField, detectFields } from '@/lib/universalFieldDetector';

// View generators
import {
  generateDataTableConfig,
  generateFormConfig,
  generateKanbanConfig,
  generateDAGConfig,
  generateViewConfig
} from '@/lib/viewConfigGenerator';
```

---

## 🎯 Migration Checklist

**Replace Old Imports:**
```typescript
// ❌ OLD (remove these)
import { detectColumnCapabilities } from '@/lib/data_transform_render';
import { getCategoryProperties } from '@/lib/fieldCategoryRegistry';

// ✅ NEW (use these)
import { generateDataTableConfig } from '@/lib/viewConfigGenerator';
import { detectField } from '@/lib/universalFieldDetector';
```

**Replace Manual Config:**
```typescript
// ❌ OLD: 150+ lines of manual column config
const columns = [
  { key: 'name', label: 'Name', sortable: true, ... },
  { key: 'budget_allocated_amt', label: 'Budget', ... },
  // ... 20+ more
];

// ✅ NEW: 1 line auto-generated
const config = generateDataTableConfig(fieldKeys);
```

**Test with:**
- ✅ Project entity (all field types)
- ✅ Task entity (foreign keys, dates, stages)
- ✅ Form entity (JSONB metadata)
- ✅ Settings entities (reordering, colors)

---

**Last Updated**: 2025-11-12
**Files**: `universalFieldDetector.ts` (712 LOC), `viewConfigGenerator.ts` (450 LOC)
**Benefits**: 98% code reduction, type-safe, consistent across all views
