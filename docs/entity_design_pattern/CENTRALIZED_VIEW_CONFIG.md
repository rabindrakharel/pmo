# Centralized View Config - All Views Share Same Output

## 🎯 Architecture

```
Column Names (from Database API)
        ↓
universalFieldDetector.ts (ONE source of truth)
        ↓
viewConfigGenerator.ts (View-specific adapters)
        ↓
    ┌───────┬───────┬────────┬──────┐
    │       │       │        │      │
DataTable  Form  Kanban    DAG   [All Views]
```

**Key Principle**: ONE detection → ALL views use same logic → Guaranteed consistency

---

## 📊 Input & Output

### INPUT (Always the Same)
```typescript
// Column names from database
const fieldKeys = ['name', 'budget_allocated_amt', 'dl__project_stage', 'is_active'];

// Optional metadata
const options = {
  dataTypes: { metadata: 'jsonb' },  // For JSONB/array detection
  requiredFields: ['name'],          // Required in forms
  kanbanGroupBy: 'dl__project_stage', // Explicit kanban column
  dagStageField: 'dl__project_stage'  // Explicit DAG field
};
```

### OUTPUT (One Call, All Views)
```typescript
const config = generateViewConfig(fieldKeys, options);

// config = {
//   fields: [UniversalFieldMetadata],   // Raw metadata for all fields
//
//   dataTable: {
//     columns: [...],           // All columns
//     visibleColumns: [...],    // Only visible=true
//     hiddenColumns: [...],     // Hidden column keys
//     editableColumns: [...],   // Only editable=true
//     searchableFields: [...]   // Fields to include in search
//   },
//
//   form: {
//     fields: [...],            // All form fields
//     editableFields: [...],    // Only editable
//     visibleFields: [...],     // Only visible
//     requiredFields: [...],    // Required field keys
//     systemFields: [...]       // System fields (id, timestamps)
//   },
//
//   kanban: {                   // Only if groupable field exists
//     groupByField: 'dl__project_stage',
//     groupByFieldLabel: 'Project Stage',
//     loadColumnsFrom: 'settings',
//     cardFields: [...],
//     cardTitleField: 'name',
//     allowDragDrop: true,
//     allowAddCard: true
//   },
//
//   dag: {                      // Only if stage/funnel field exists
//     stageField: 'dl__project_stage',
//     stageFieldLabel: 'Project Stage',
//     loadNodesFrom: 'settings',
//     datalabel: 'dl__project_stage',
//     allowTransition: true,
//     showDropdown: true
//   }
// }
```

---

## 🔑 Important: `id` Field Handling

**Critical Distinction**: `visible: false` ≠ "not in data"

```typescript
// API returns data with 'id'
const apiResponse = [
  { id: 'uuid-123', name: 'Project Alpha', budget_allocated_amt: 50000 },
  { id: 'uuid-456', name: 'Project Beta', budget_allocated_amt: 75000 }
];

// Generate config
const config = generateDataTableConfig(['id', 'name', 'budget_allocated_amt']);

// config.visibleColumns = [
//   { key: 'name', visible: true, ... },
//   { key: 'budget_allocated_amt', visible: true, ... }
// ] → 'id' NOT in visibleColumns

// config.hiddenColumns = ['id'] → 'id' is hidden

// BUT: The table component receives FULL data including 'id'
<EntityDataTable
  columns={config.visibleColumns}  // Only shows 'name', 'budget_allocated_amt'
  data={apiResponse}               // Has 'id', 'name', 'budget_allocated_amt'
  onEdit={(row) => {
    console.log(row.id);           // ✅ 'uuid-123' - AVAILABLE!
    api.update(row.id, editedData); // ✅ Can call backend
  }}
/>

// USER SEES: 2 columns (name, budget)
// BACKEND GETS: row.id for API calls
// PERFECT: Security + Functionality
```

**Why This Matters**:
- ✅ User doesn't see ugly UUIDs in table
- ✅ Backend can call `PUT /api/project/:id` with `row.id`
- ✅ Delete/Edit handlers work: `onDelete={(row) => api.delete(row.id)}`
- ✅ Inline editing sends `id` in request
- ✅ Navigation works: `onClick={() => navigate(\`/project/\${row.id}\`)}`

---

## 🔄 View-Specific Adapters

### 1. DataTable Config

**What It Provides**:
- Visible columns only (auto-hides `id`, `*_id`, system fields)
- Auto-generates `*_name` columns for hidden `*_id` foreign keys
- Inline editing config
- Search fields
- Sort/filter capabilities

**Usage**:
```typescript
// Generate config
const config = generateDataTableConfig([
  'id', 'name', 'project_id', 'budget_allocated_amt', 'dl__task_stage', 'is_active', 'created_ts'
]);

// Use in EntityDataTable
<EntityDataTable
  columns={config.visibleColumns}          // Only visible columns (NO 'id' column)
  searchFields={config.searchableFields}   // Only searchable
  editableColumns={config.editableColumns} // Only editable
  data={rows}                              // INCLUDES row.id in data!
  onEdit={(row) => api.update(row.id, data)}    // row.id available
  onDelete={(row) => api.delete(row.id)}        // row.id available
/>

// IMPORTANT: 'id' behavior
// ✅ visible: false → NO column shown in UI
// ✅ row.id exists → Available for API calls (edit, delete, etc.)
// ✅ Backend needs id → Always fetch it from API
// ✅ User never sees id → Hidden from table

// Result:
// visibleColumns = [
//   { key: 'name', title: 'Name', width: '200px', editable: true, ... },
//   { key: 'project_name', title: 'Project Name', width: '200px', ... }, // AUTO-GENERATED!
//   { key: 'budget_allocated_amt', title: 'Budget...', format: formatCurrency, ... },
//   { key: 'dl__task_stage', title: 'Task Stage', renderType: 'badge', ... },
//   { key: 'is_active', title: 'Is Active', format: formatBoolean, editable: true, ... }
// ]
// hiddenColumns = ['id', 'project_id', 'created_ts'] // System + FK hidden
```

---

### 2. Form Config

**What It Provides**:
- Form fields with correct input types
- Component assignments (DAGVisualizer, MetadataTable, etc.)
- Required field validation
- Data transformers (toApi, toDisplay)
- Editable/readonly logic

**Usage**:
```typescript
// Generate config
const config = generateFormConfig(
  ['name', 'budget_allocated_amt', 'dl__project_stage', 'is_active', 'metadata'],
  undefined,
  ['name'] // Required fields
);

// Use in EntityFormContainer
<EntityFormContainer
  fields={config.visibleFields}
  requiredFields={config.requiredFields}
/>

// Result:
// visibleFields = [
//   { key: 'name', type: 'text', required: true, editable: true },
//   { key: 'budget_allocated_amt', type: 'currency', component: undefined },
//   { key: 'dl__project_stage', type: 'dag-select', component: 'DAGVisualizer', loadFromSettings: true },
//   { key: 'is_active', type: 'checkbox', editable: true },
//   { key: 'metadata', type: 'jsonb', component: 'MetadataTable', editable: true }
// ]
```

---

### 3. Kanban Config

**What It Provides**:
- Auto-detects grouping field (`dl__*_stage`, `dl__*_status`, `status`)
- Card fields (visible, non-system)
- Card title field (auto-detects `name`, `code`, or first text field)
- Drag-drop config
- Column loading source (settings/entity)

**Usage**:
```typescript
// Generate config (auto-detects dl__task_stage as grouping field)
const config = generateKanbanConfig([
  'id', 'name', 'dl__task_stage', 'assignee_name', 'priority', 'created_ts'
]);

// Use in KanbanBoard
<KanbanBoard
  groupByField={config.groupByField}
  cardFields={config.cardFields}
  cardTitleField={config.cardTitleField}
  allowDragDrop={config.allowDragDrop}
/>

// Result:
// groupByField = 'dl__task_stage'  // AUTO-DETECTED
// cardFields = [
//   { key: 'name', type: 'text', ... },
//   { key: 'assignee_name', type: 'text', ... },
//   { key: 'priority', type: 'select', ... }
// ]  // Excludes id, dl__task_stage (used for grouping), created_ts (system field)
// cardTitleField = 'name'  // AUTO-DETECTED
```

---

### 4. DAG Config

**What It Provides**:
- Auto-detects stage/funnel field (`dl__*_stage`, `dl__*_funnel`)
- Settings datalabel key
- Transition permissions
- Dropdown config

**Usage**:
```typescript
// Generate config (auto-detects dl__project_stage)
const config = generateDAGConfig([
  'name', 'code', 'dl__project_stage', 'budget_allocated_amt'
]);

// Use in DAGVisualizer
<DAGVisualizer
  stageField={config.stageField}
  datalabel={config.datalabel}
  allowTransition={config.allowTransition}
  showDropdown={config.showDropdown}
/>

// Result:
// stageField = 'dl__project_stage'  // AUTO-DETECTED
// datalabel = 'dl__project_stage'
// allowTransition = true  (field is editable)
// showDropdown = true
```

---

## 🎯 Complete Example: Project Entity

```typescript
// INPUT: Column names from API
const projectFields = [
  'id',
  'name',
  'code',
  'descr',
  'project_manager_id',       // FK → auto-gen project_manager_name
  'budget_allocated_amt',
  'dl__project_stage',
  'is_active',
  'metadata',
  'tags',
  'created_ts',
  'updated_ts'
];

// GENERATE: All view configs in ONE call
const config = generateViewConfig(projectFields, {
  requiredFields: ['name', 'code'],
  dataTypes: { metadata: 'jsonb', tags: 'varchar[]' }
});

// ========================================================================
// USE IN DATA TABLE
// ========================================================================
<EntityDataTable
  columns={config.dataTable.visibleColumns}
  // Returns:
  // - name, code, descr (visible, editable)
  // - project_manager_name (AUTO-GENERATED from project_manager_id)
  // - budget_allocated_amt (currency formatted)
  // - dl__project_stage (badge, dropdown)
  // - is_active (checkbox)
  // - metadata (JSON viewer)
  // - tags (comma-separated)
  // HIDDEN: id, project_manager_id, created_ts, updated_ts
/>

// ========================================================================
// USE IN FORM
// ========================================================================
<EntityFormContainer
  fields={config.form.visibleFields}
  // Returns:
  // - name (text, required)
  // - code (text, required)
  // - descr (textarea)
  // - project_manager_id (select, loads from 'employee' entity)
  // - budget_allocated_amt (currency input)
  // - dl__project_stage (DAGVisualizer + dropdown)
  // - is_active (checkbox)
  // - metadata (MetadataTable JSONB editor)
  // - tags (TagsInput)
  // EXCLUDED: id, created_ts, updated_ts (system fields)
/>

// ========================================================================
// USE IN KANBAN
// ========================================================================
{config.kanban && (
  <KanbanBoard
    groupByField={config.kanban.groupByField}
    // AUTO-DETECTED: dl__project_stage
    cardFields={config.kanban.cardFields}
    // Cards show: name, code, budget_allocated_amt, is_active, tags
    // EXCLUDED: id, project_manager_id, dl__project_stage (grouping), metadata, timestamps
    cardTitleField={config.kanban.cardTitleField}
    // AUTO-DETECTED: 'name'
  />
)}

// ========================================================================
// USE IN DAG
// ========================================================================
{config.dag && (
  <DAGVisualizer
    stageField={config.dag.stageField}
    // AUTO-DETECTED: dl__project_stage
    datalabel={config.dag.datalabel}
    // 'dl__project_stage' → loads from setting_datalabel
    currentStage={project.dl__project_stage}
  />
)}
```

---

## ✅ What This Achieves

### Single Source of Truth
- **ONE detection function** (`detectField`)
- **ONE config generator** (`generateViewConfig`)
- **ALL views** use same logic

### Automatic Behavior
| Feature | Auto-Behavior |
|---------|---------------|
| Foreign keys | Hidden, auto-gen `*_name` columns |
| System fields | Readonly, hidden in forms |
| Currency fields | $ formatting, right-aligned |
| Stage/funnel fields | DAG visualizer, badge display |
| Boolean fields | Checkbox, ✓/✗ display |
| JSONB fields | MetadataTable editor |
| Tags fields | TagsInput, array ↔ string transform |

### View-Specific Optimization
| View | Gets Only What It Needs |
|------|------------------------|
| **DataTable** | Visible columns, hide FK/system fields, auto-gen name columns |
| **Form** | Editable fields, correct input types, required validation |
| **Kanban** | Card fields, grouping column, title field |
| **DAG** | Stage field, settings datalabel, transition permissions |

### Consistency Guarantee
- Same field (`budget_allocated_amt`) behaves identically across all views:
  - **DataTable**: $ formatted, right-aligned, editable, currency edit type
  - **Form**: Currency input, $ prefix, required validation
  - **Kanban**: $ formatted on card (if included)
  - **DAG**: N/A (not a stage field)

---

## 🚀 Usage Patterns

### Pattern 1: Quick Column Generation (DataTable)
```typescript
// OLD WAY (manual, 150+ lines)
const columns = [
  { key: 'name', title: 'Name', width: '200px', ... },
  // ... 20+ more columns
];

// NEW WAY (1 line)
const columns = quickColumns(['name', 'project_id', 'budget_allocated_amt', 'dl__task_stage']);
```

### Pattern 2: Entity Config Integration
```typescript
// Entity config (entityConfigs.ts)
export const projectConfig = {
  fields: [
    { key: 'name', required: true },
    { key: 'budget_allocated_amt' },
    { key: 'dl__project_stage' }
  ],
  kanbanGroupBy: 'dl__project_stage',
  dagStageField: 'dl__project_stage'
};

// Generate all view configs
const viewConfig = generateViewConfigFromEntity(projectConfig);

// Use everywhere
<EntityMainPage config={viewConfig} />
```

### Pattern 3: Conditional Views
```typescript
const config = generateViewConfig(fieldKeys);

// Show different views based on what's available
{config.kanban && <KanbanBoard config={config.kanban} />}
{config.dag && <DAGVisualizer config={config.dag} />}
<EntityDataTable columns={config.dataTable.visibleColumns} />
```

---

## 📁 File Structure

```
apps/web/src/lib/
├── universalFieldDetector.ts      ← ONE source of truth (712 LOC)
├── viewConfigGenerator.ts         ← View adapters (NEW, 450 LOC)
└── [OLD FILES - TO DEPRECATE]
    ├── fieldCategoryRegistry.ts   ← 715 LOC (redundant)
    ├── columnGenerator.ts         ← 231 LOC (redundant)
    └── data_transform_render.tsx  ← 1,117 LOC (redundant)
```

**Before**: 2,716 LOC across 4 files
**After**: 1,162 LOC across 2 files (57% reduction)

---

## 🔄 Migration Path

### Phase 1: Update EntityDataTable
```typescript
import { generateDataTableConfig } from '@/lib/viewConfigGenerator';

const config = generateDataTableConfig(columnNames);
<EntityDataTable columns={config.visibleColumns} />
```

### Phase 2: Update EntityFormContainer
```typescript
import { generateFormConfig } from '@/lib/viewConfigGenerator';

const config = generateFormConfig(fieldKeys, undefined, requiredFields);
<EntityFormContainer fields={config.visibleFields} />
```

### Phase 3: Update KanbanBoard
```typescript
import { generateKanbanConfig } from '@/lib/viewConfigGenerator';

const config = generateKanbanConfig(fieldKeys);
<KanbanBoard config={config} />
```

### Phase 4: Update DAGVisualizer
```typescript
import { generateDAGConfig } from '@/lib/viewConfigGenerator';

const config = generateDAGConfig(fieldKeys);
<DAGVisualizer config={config} />
```

---

## 📝 Summary

### What We Built
- ✅ ONE source of truth (universalFieldDetector)
- ✅ View-specific adapters (viewConfigGenerator)
- ✅ Auto-detection (12 patterns)
- ✅ Auto-generation (FK name columns, card fields, etc.)
- ✅ Guaranteed consistency (same detection everywhere)

### Input
- Column names from database API
- Optional: dataTypes, requiredFields, explicit configs

### Output
- DataTable config (visible columns, editable, searchable)
- Form config (fields, input types, components, validation)
- Kanban config (grouping, card fields, drag-drop)
- DAG config (stage field, transitions, dropdown)

### Views Supported
1. EntityDataTable / SettingsDataTable
2. EntityFormContainer
3. KanbanBoard
4. DAGVisualizer

**All views share same central config → Perfect consistency**

---

**Files**:
- `apps/web/src/lib/universalFieldDetector.ts` (712 LOC)
- `apps/web/src/lib/viewConfigGenerator.ts` (450 LOC)

**Total**: 1,162 LOC (vs 2,716 before = 57% reduction)

**Status**: Ready for integration
