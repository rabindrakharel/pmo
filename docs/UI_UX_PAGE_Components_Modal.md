# UI/UX Reusable Components Reference

> **MANDATORY**: Use standardized components. Never create entity-specific UI components.

---

## 🎯 Core Data Model Concepts

### **Entity System Architecture**

**Every domain is an entity** with CRUD operations stored in `d_{entity}` tables:
- **Entity**: Business object (project, task, employee, client, etc.)
- **Parent-Child**: Relationships stored in `d_entity_id_map` (not foreign keys)
- **RBAC**: Permissions stored in `entity_id_rbac_map`
- **Metadata**: All entity types defined in `d_entity` table

**d_entity Table Role** (Source of Truth):
```sql
-- Central registry for ALL entity metadata
CREATE TABLE app.d_entity (
    code varchar(50) PRIMARY KEY,          -- 'project', 'task', 'office'
    ui_icon varchar(50),                   -- Lucide icon: 'FolderOpen'
    ui_label varchar(100),                 -- Display: 'Projects'
    child_entities jsonb,                  -- Child entity metadata
    display_order int4                     -- Menu order
);
```

**What d_entity drives**:
- Sidebar navigation (icons, labels, order)
- Entity detail page tabs (child entities)
- Entity pickers/dropdowns (ui_label + ui_icon)
- Dynamic routing (child entity tabs auto-generated)

**Parent-Child Relationship Pattern**:
```sql
-- All relationships stored in d_entity_id_map
CREATE TABLE app.d_entity_id_map (
    parent_entity_type varchar(50),  -- 'PROJECT'
    parent_entity_id uuid,           -- project.id
    child_entity_type varchar(50),   -- 'TASK'
    child_entity_id uuid             -- task.id
);

-- Example: Project → Tasks
INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('PROJECT', 'abc-123', 'TASK', 'def-456');
```

**RBAC Pattern**:
```sql
-- Permissions per entity instance
CREATE TABLE app.entity_id_rbac_map (
    entity_type varchar(50),
    entity_id uuid,
    user_id uuid,
    permission_id int  -- 1=view, 2=edit, 3=delete, 4=share, 5=owner
);
```

---

## 📊 Data Tables (Universal Display)

### **Use Case Decision**:
| Use Case | Component | Why |
|----------|-----------|-----|
| **Entity records** (project, task, etc.) | `EntityDataTable` | Full CRUD, inline editing, parent-child filtering |
| **Settings/datalabel** (dropdowns, stages) | `SettingsDataTable` | Reordering, color badges, settings-specific features |

### **EntityDataTable** (Entity Records)

**Location**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Features**:
- Inline editing (text, select, tags, currency, dates)
- Parent-child filtering via `d_entity_id_map`
- Add row with parent context pre-filled
- Bulk selection and actions

**Usage**:
```tsx
<EntityDataTable
  entityType="task"
  data={tasks}
  columns={columns}
  inlineEditable={true}
  allowAddRow={true}
  parentType="project"
  parentId={projectId}
/>
```

### **SettingsDataTable** (Settings/Datalabel)

**Location**: `apps/web/src/components/shared/ui/SettingsDataTable.tsx`

**Features**:
- Drag-drop row reordering (for display_order)
- Color badge editing
- Specialized for `setting_datalabel` table

**Usage**:
```tsx
<SettingsDataTable
  entityType="setting"
  data={settingRows}
  columns={settingColumns}
  onReorder={handleReorder}
/>
```

---

## 📈 Visualizations (Data Display)

| Component | When to Use | Data Type | Output |
|-----------|-------------|-----------|--------|
| **DAGVisualizer** | Workflow stages/funnels | `dl__{entity}_stage`, `dl__{entity}_funnel` fields | Topological graph with parent→child arrows |
| **KanbanBoard** | Task boards | Status-based entities | Drag-drop cards across status columns |
| **CalendarView** | Event scheduling | Time-based availability | Weekly grid with person filtering |
| **DateRangeVisualizer** | Date ranges | `from_ts` + `to_ts` pairs | Timeline bars |

### **DAGVisualizer** (Workflow Stages/Funnels)

**Location**: `apps/web/src/components/workflow/DAGVisualizer.tsx`

**Naming Convention**:
```typescript
// Stage fields (workflow states)
dl__project_stage     // Project: initiation → planning → execution → closure
dl__task_stage        // Task: backlog → in_progress → blocked → done
dl__sales_funnel      // Sales: lead → qualified → proposal → won/lost

// Pattern: dl__{entityname}_{stage|funnel}
```

**Data Source**: `setting_datalabel` table
```sql
SELECT id, name, parent_ids FROM app.setting_datalabel
WHERE datalabel = 'dl__project_stage'
ORDER BY display_order;

-- Returns DAG nodes:
-- {id: 0, name: 'Initiation', parent_ids: []}
-- {id: 1, name: 'Planning', parent_ids: [0]}
-- {id: 2, name: 'Execution', parent_ids: [1]}
-- {id: 3, name: 'Closure', parent_ids: [2]}
```

**Usage**:
```tsx
// Auto-rendered in EntityFormContainer for dl__*_stage or dl__*_funnel fields
const dagNodes = await loadDagNodes('dl__project_stage');

<DAGVisualizer
  nodes={dagNodes}
  currentNodeId={project.dl__project_stage}  // Highlights current stage
  onNodeClick={handleStageChange}
/>
```

**How It Works**:
1. Field key starts with `dl__` and contains `stage` or `funnel`
2. EntityFormContainer detects pattern → loads DAG structure from settings API
3. Renders DAGVisualizer with topological layout (parent nodes above children)
4. Dropdown below DAG allows selecting stage (updates entity field)

---

## 📝 Entity Form Container (Universal Form)

**Location**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Auto-Detection Rules**:
| Pattern | Field Type | Example |
|---------|------------|---------|
| `*_amt`, `*_price`, `*_cost` | Currency input ($ prefix) | `budget_allocated_amt` |
| `dl__*_stage`, `dl__*_funnel` | DAGVisualizer + dropdown | `dl__project_stage` |
| `*_ts`, `*_at` | Datetime input | `created_ts` |
| `tags` | Tags input (array ↔ string) | `tags` |
| `metadata` | JSONB editor (MetadataTable) | `metadata` |
| `from_ts` + `to_ts` | DateRangeVisualizer | `from_ts`, `to_ts` |
| `*_attachment`, `*_file` | S3 presigned upload | `artifact_attachment` |

**Usage**:
```tsx
<EntityFormContainer
  config={config}
  data={data}
  isEditing={isEditing}
  onChange={handleChange}
  mode="edit"
/>

// Config example:
fields: [
  { key: 'name', type: 'text', required: true },
  { key: 'dl__project_stage', type: 'select', loadOptionsFromSettings: true }, // DAG auto-renders
  { key: 'budget_allocated_amt', type: 'number' }, // $ prefix auto-added
  { key: 'tags', type: 'tags' },
  { key: 'metadata', type: 'metadata' } // JSONB editor
]
```

---

## 🧭 Navigation & Tabs

### **DynamicChildEntityTabs**

**Location**: `apps/web/src/components/shared/layout/DynamicChildEntityTabs.tsx`

**Data Source**: `/api/v1/entity/:type/children` (queries `d_entity.child_entities`)

**Usage**:
```tsx
// Loads child entities from d_entity table
const { tabs } = useDynamicChildEntityTabs('project', projectId);

<DynamicChildEntityTabs
  tabs={[
    { id: 'overview', label: 'Overview', path: `/project/${projectId}` },
    ...tabs  // Auto-generated: Tasks, Wiki, Artifacts, Forms, etc.
  ]}
  activeTab={currentTab}
/>
```

**Adding New Child Tab**:
```sql
-- Update d_entity table to add child relationship
UPDATE app.d_entity
SET child_entities = child_entities || '[{"entity": "invoice", "ui_icon": "FileText", "ui_label": "Invoices", "order": 7}]'::jsonb
WHERE code = 'project';

-- Tabs auto-appear, no frontend code needed
```

---

## 🔧 Modals & Overlays

| Component | Purpose | Usage |
|-----------|---------|-------|
| **UnifiedLinkageModal** | Link parent-child entities | Creates `d_entity_id_map` records |
| **EntityEditModal** | Edit entity in modal | Wraps EntityFormContainer |
| **ShareModal** | Generate share links | Public entity sharing |

---

## ✅ Mandatory Checklist (All Entity Development)

- [ ] Use **EntityDataTable** for entity records (not custom tables)
- [ ] Use **SettingsDataTable** for settings/datalabel records
- [ ] Use **EntityFormContainer** for all forms (auto-detects 15+ field types)
- [ ] Use **DynamicChildEntityTabs** (loads from `d_entity` API, never hardcode)
- [ ] Use **DAGVisualizer** for `dl__{entity}_stage` or `dl__{entity}_funnel` fields
- [ ] Use **DateRangeVisualizer** for `from_ts` + `to_ts` pairs
- [ ] Use **UnifiedLinkageModal** for all parent-child relationships
- [ ] Load dropdowns from settings API (`loadOptionsFromSettings: true`)
- [ ] Query `d_entity` API for metadata (icons, labels, child entities)
- [ ] Store relationships in `d_entity_id_map` (not foreign keys)
- [ ] Store permissions in `entity_id_rbac_map`

---

## 🚨 Anti-Patterns (DO NOT DO)

| ❌ Anti-Pattern | ✅ Correct Pattern |
|----------------|-------------------|
| Creating entity-specific tables/forms | Use EntityDataTable + EntityFormContainer |
| Hardcoding dropdown options | Use `loadOptionsFromSettings: true` |
| Hardcoding child entity tabs | Use DynamicChildEntityTabs (loads from d_entity) |
| Adding foreign keys to entity tables | Use d_entity_id_map for relationships |
| Hardcoding entity icons/labels | Query d_entity table via API |
| Direct S3 upload without presigned URL | Use S3 presigned URL workflow |
| Creating custom workflow visualizations | Use DAGVisualizer for stages/funnels |

---

## 📚 Related Documentation

- **[Data Model](./datamodel/datamodel.md)** - DDL schemas, d_entity table, d_entity_id_map
- **[Universal Entity System](./entity_design_pattern/universal_entity_system.md)** - Architecture patterns
- **[DRY Factory Patterns](./entity_design_pattern/DRY_FACTORY_PATTERNS.md)** - Code generation
- **[Settings System](./settings/settings.md)** - Datalabel tables, DAG structures

---

**Last Updated**: 2025-11-11
**Status**: MANDATORY for all entity development
