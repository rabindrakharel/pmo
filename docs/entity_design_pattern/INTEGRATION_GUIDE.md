# Universal Field Detector - Integration Guide

**Purpose**: Practical examples showing how to integrate `universalFieldDetector.ts` and `viewConfigGenerator.ts` into components.

**Files**:
- `apps/web/src/lib/universalFieldDetector.ts` - Core detection logic
- `apps/web/src/lib/viewConfigGenerator.ts` - View-specific adapters

---

## Quick Start: 3-Line Integration

**Before** (Manual column configuration - 150+ lines):
```typescript
const columns = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    filterable: true,
    width: '200px',
    align: 'left',
    inputType: 'text',
    editable: true
  },
  {
    key: 'budget_allocated_amt',
    label: 'Budget Allocated Amount',
    sortable: true,
    filterable: true,
    width: '120px',
    align: 'right',
    inputType: 'currency',
    editable: true,
    format: formatCurrency
  },
  // ... 20+ more columns
];
```

**After** (Auto-generated - 3 lines):
```typescript
import { generateViewConfig } from '@/lib/viewConfigGenerator';

const config = generateViewConfig(['name', 'budget_allocated_amt', 'dl__project_stage', 'created_ts']);
// That's it! All columns auto-configured with correct types, formatting, editing
```

---

## Integration Pattern 1: EntityDataTable

**File**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Current Pattern** (Before Integration):
```typescript
import { detectColumnCapabilities, formatCurrency } from '@/lib/data_transform_render';

function EntityDataTable({ data, entityType }) {
  // Manual column configuration
  const columns = useMemo(() => {
    const caps = detectColumnCapabilities(Object.keys(data[0] || {}));
    return caps.map(cap => ({
      key: cap.key,
      label: cap.label,
      sortable: cap.sortable,
      // ... manual mapping
    }));
  }, [data]);

  return <DataTable columns={columns} data={data} />;
}
```

**New Pattern** (After Integration):
```typescript
import { generateDataTableConfig } from '@/lib/viewConfigGenerator';

function EntityDataTable({ data, entityType }) {
  const config = useMemo(() => {
    const fieldKeys = Object.keys(data[0] || {});
    return generateDataTableConfig(fieldKeys);
  }, [data]);

  return (
    <DataTable
      columns={config.visibleColumns}      // Auto-excludes 'id', hidden fields
      data={data}
      onEdit={(row) => api.update(row.id, data)}  // row.id still available!
      editableColumns={config.editableColumns}    // Auto-detected editable fields
    />
  );
}
```

**Benefits**:
- ✅ Automatic field type detection (currency, date, boolean, etc.)
- ✅ Correct formatting ($ for amounts, % for percentages, "3 days ago" for timestamps)
- ✅ Proper inline editing types (select for dl__*, currency input for *_amt)
- ✅ Auto-hide 'id' and foreign key columns, but keep in data for API calls
- ✅ Auto-generate *_name columns for *_id foreign keys

---

## Integration Pattern 2: EntityFormContainer

**File**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Current Pattern** (Before Integration):
```typescript
function EntityFormContainer({ entityType, initialData }) {
  // Manual field configuration
  const fields = [
    { key: 'name', type: 'text', label: 'Name', required: true },
    { key: 'budget_allocated_amt', type: 'currency', label: 'Budget' },
    { key: 'dl__project_stage', type: 'dag-select', component: 'DAGVisualizer' },
    // ... manual for every field
  ];

  return <DynamicForm fields={fields} />;
}
```

**New Pattern** (After Integration):
```typescript
import { generateFormConfig } from '@/lib/viewConfigGenerator';

function EntityFormContainer({ entityType, initialData }) {
  const config = useMemo(() => {
    const fieldKeys = Object.keys(initialData || {});
    return generateFormConfig(fieldKeys, {
      requiredFields: ['name', 'code'] // Optional: mark required
    });
  }, [initialData]);

  return (
    <DynamicForm
      fields={config.editableFields}  // Only editable fields (no id, timestamps)
      requiredFields={config.requiredFields}
    />
  );
}
```

**Auto-Detection Examples**:
```typescript
// Field: budget_allocated_amt
{
  key: 'budget_allocated_amt',
  label: 'Budget Allocated Amount',
  type: 'currency',              // ✅ Auto-detected from *_amt
  editable: true,
  placeholder: 'Enter amount...'
}

// Field: dl__project_stage
{
  key: 'dl__project_stage',
  label: 'Project Stage',
  type: 'dag-select',            // ✅ Auto-detected from dl__*_stage
  component: 'DAGVisualizer',    // ✅ Auto-assigned
  loadFromSettings: true         // ✅ Loads from setting_datalabel
}

// Field: is_active
{
  key: 'is_active',
  label: 'Is Active',
  type: 'checkbox',              // ✅ Auto-detected from is_*
  editable: true
}

// Field: created_ts
{
  key: 'created_ts',
  label: 'Created',
  type: 'readonly',              // ✅ Auto-detected system field
  editable: false                // ✅ Not shown in form
}
```

---

## Integration Pattern 3: KanbanBoard

**File**: `apps/web/src/components/shared/visualization/KanbanBoard.tsx`

**Current Pattern** (Before Integration):
```typescript
function KanbanBoard({ tasks }) {
  // Manual configuration
  const groupByField = 'dl__task_stage'; // Hardcoded
  const cardTitleField = 'name';         // Hardcoded
  const cardFields = ['assignee_name', 'due_date']; // Hardcoded

  return <Kanban groupBy={groupByField} cards={tasks} />;
}
```

**New Pattern** (After Integration):
```typescript
import { generateKanbanConfig } from '@/lib/viewConfigGenerator';

function KanbanBoard({ tasks }) {
  const config = useMemo(() => {
    const fieldKeys = Object.keys(tasks[0] || {});
    return generateKanbanConfig(fieldKeys);
  }, [tasks]);

  if (!config) {
    return <div>No stage/status field found for Kanban view</div>;
  }

  return (
    <Kanban
      groupByField={config.groupByField}     // Auto-detected: dl__*_stage > dl__*_status > status
      cardTitleField={config.cardTitleField} // Auto: name > code > id
      cardFields={config.cardFields}         // Auto: visible fields except title
      allowDragDrop={config.allowDragDrop}   // true if groupBy is editable
    />
  );
}
```

**Auto-Detection Logic**:
```typescript
// Priority order for groupByField:
// 1. dl__*_stage (highest priority - workflow stages)
// 2. dl__*_status (medium priority - status tracking)
// 3. status (fallback - generic status)

// Example field detection:
const fields = ['name', 'dl__task_stage', 'assignee_name', 'due_date', 'status'];

// Result:
{
  groupByField: 'dl__task_stage',  // ✅ Picked dl__*_stage first
  cardTitleField: 'name',          // ✅ Picked 'name' first
  cardFields: ['assignee_name', 'due_date', 'status'], // ✅ All visible except title
  allowDragDrop: true              // ✅ dl__task_stage is editable
}
```

---

## Integration Pattern 4: DAGVisualizer

**File**: `apps/web/src/components/shared/visualization/DAGVisualizer.tsx`

**Current Pattern** (Before Integration):
```typescript
function DAGVisualizer({ entityType }) {
  // Hardcoded field mapping
  const stageFieldMap = {
    project: 'dl__project_stage',
    task: 'dl__task_stage',
    sales: 'dl__sales_funnel'
  };
  const stageField = stageFieldMap[entityType];

  return <DAG stageField={stageField} />;
}
```

**New Pattern** (After Integration):
```typescript
import { generateDAGConfig } from '@/lib/viewConfigGenerator';

function DAGVisualizer({ entityType, record }) {
  const config = useMemo(() => {
    const fieldKeys = Object.keys(record || {});
    return generateDAGConfig(fieldKeys);
  }, [record]);

  if (!config) {
    return <div>No stage/funnel field found for DAG visualization</div>;
  }

  return (
    <DAG
      stageField={config.stageField}           // Auto-detected: dl__*_stage or dl__*_funnel
      datalabel={config.datalabel}             // Auto: extracted from field name
      allowTransition={config.allowTransition} // true if field is editable
      showDropdown={config.showDropdown}       // true for editable stages
    />
  );
}
```

**Auto-Detection Examples**:
```typescript
// Field: dl__project_stage
{
  stageField: 'dl__project_stage',
  datalabel: 'dl__project_stage',    // ✅ Extracted
  allowTransition: true,             // ✅ Editable
  showDropdown: true
}

// Field: dl__sales_funnel
{
  stageField: 'dl__sales_funnel',
  datalabel: 'dl__sales_funnel',     // ✅ Extracted
  allowTransition: true,
  showDropdown: true
}
```

---

## Integration Pattern 5: Universal View Config (All Views at Once)

**Use Case**: Entity detail page showing multiple views (table, form, kanban, DAG)

```typescript
import { generateViewConfig } from '@/lib/viewConfigGenerator';

function EntityDetailPage({ entityType, entityId }) {
  const { data } = useQuery(`/api/v1/${entityType}/${entityId}`);

  const viewConfig = useMemo(() => {
    if (!data) return null;
    const fieldKeys = Object.keys(data);
    return generateViewConfig(fieldKeys);
  }, [data]);

  if (!viewConfig) return <Loading />;

  return (
    <div>
      {/* Tab 1: Details (Form) */}
      <DynamicForm
        fields={viewConfig.form.editableFields}
        requiredFields={viewConfig.form.requiredFields}
      />

      {/* Tab 2: Related Data (Table) */}
      <EntityDataTable
        columns={viewConfig.dataTable.visibleColumns}
        editableColumns={viewConfig.dataTable.editableColumns}
      />

      {/* Tab 3: Kanban (if applicable) */}
      {viewConfig.kanban && (
        <KanbanBoard
          groupByField={viewConfig.kanban.groupByField}
          cardFields={viewConfig.kanban.cardFields}
        />
      )}

      {/* Tab 4: DAG (if applicable) */}
      {viewConfig.dag && (
        <DAGVisualizer
          stageField={viewConfig.dag.stageField}
          datalabel={viewConfig.dag.datalabel}
        />
      )}
    </div>
  );
}
```

---

## Advanced: Field Overrides

**Use Case**: Override auto-detected behavior for specific fields

```typescript
import { generateDataTableConfig, detectField } from '@/lib/viewConfigGenerator';

function CustomEntityTable({ data }) {
  const config = useMemo(() => {
    const fieldKeys = Object.keys(data[0] || {});
    const baseConfig = generateDataTableConfig(fieldKeys);

    // Override auto-detected config for specific fields
    return {
      ...baseConfig,
      columns: baseConfig.columns.map(col => {
        // Example: Make 'name' column wider
        if (col.key === 'name') {
          return { ...col, width: '300px' };
        }

        // Example: Make 'budget' always visible (even if normally hidden)
        if (col.key === 'budget_allocated_amt') {
          return { ...col, visible: true };
        }

        return col;
      })
    };
  }, [data]);

  return <DataTable columns={config.visibleColumns} data={data} />;
}
```

---

## Migration Checklist

**Step 1: Install utilities** (already done)
- ✅ `apps/web/src/lib/universalFieldDetector.ts`
- ✅ `apps/web/src/lib/viewConfigGenerator.ts`

**Step 2: Update imports in components**
```typescript
// OLD imports (to replace)
import { detectColumnCapabilities } from '@/lib/data_transform_render';
import { getCategoryProperties } from '@/lib/fieldCategoryRegistry';

// NEW imports
import { generateDataTableConfig, generateFormConfig } from '@/lib/viewConfigGenerator';
import { detectField } from '@/lib/universalFieldDetector';
```

**Step 3: Replace manual column generation**
```typescript
// OLD: Manual column config (150+ lines)
const columns = [ /* ... */ ];

// NEW: Auto-generated (1 line)
const config = generateDataTableConfig(fieldKeys);
```

**Step 4: Test with existing entities**
- Test with Project entity (has all field types)
- Test with Task entity (has foreign keys, dates, stages)
- Test with Form entity (has JSONB metadata)
- Test with Settings entities (has reordering, colors)

**Step 5: Remove old utility files** (after full migration)
- Deprecate `fieldCategoryRegistry.ts` (715 LOC)
- Deprecate `columnGenerator.ts` portions (231 LOC)
- Keep `data_transform_render.tsx` for formatting functions only

---

## Benefits Summary

| Benefit | Before | After |
|---------|--------|-------|
| **Lines of code** | 150+ per entity | 3 per entity |
| **Consistency** | Manual sync across files | Automatic (ONE source) |
| **Maintainability** | Fix bugs in 4+ files | Fix in 1 function |
| **Field coverage** | 5-8 patterns detected | 12 patterns detected |
| **Type safety** | Loosely typed | Fully typed |
| **Auto-detection** | Partial | Complete |
| **View support** | Table only | Table, Form, Kanban, DAG |

---

## Troubleshooting

**Q: Field not detected correctly?**
```typescript
// Debug: Check what pattern was detected
const metadata = detectField('your_field_name');
console.log('Detected pattern:', metadata.pattern);
console.log('Input type:', metadata.inputType);
console.log('Edit type:', metadata.editType);
```

**Q: Need custom behavior for specific field?**
```typescript
// Override after auto-detection
const config = generateDataTableConfig(fieldKeys);
config.columns = config.columns.map(col =>
  col.key === 'special_field' ? { ...col, width: '500px' } : col
);
```

**Q: Field pattern not in 12 obvious patterns?**
```typescript
// Add to PATTERNS in universalFieldDetector.ts
const PATTERNS = {
  // ... existing patterns
  customPattern: {
    regex: /your_pattern$/i,
    priority: 13
  }
};
```

---

## Next Steps

1. **Integrate into EntityDataTable** - Replace manual column detection
2. **Integrate into EntityFormContainer** - Replace manual field configuration
3. **Update entity configs** - Use generateViewConfig() in entityConfigs.ts
4. **Test with all 18 entity types** - Verify auto-detection works correctly
5. **Deprecate old utilities** - Remove fieldCategoryRegistry.ts, columnGenerator.ts

---

**Last Updated**: 2025-11-12
**Version**: 1.0
**Related Docs**:
- `CENTRALIZED_VIEW_CONFIG.md` - Architecture explanation
- `UI_UX_PAGE_Components_Modal.md` - Component patterns
- `universal_entity_system.md` - DRY entity architecture
