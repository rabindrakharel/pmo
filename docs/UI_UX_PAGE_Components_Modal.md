# UI/UX Reusable Components & Patterns

> **MANDATORY**: All entity development MUST use these standardized components. Never create custom components when reusable ones exist.

---

## 📋 Component Quick Reference

### 1. **Data Tables** (Universal Display)

| Component | When to Use | Key Props | Location |
|-----------|-------------|-----------|----------|
| **FilteredDataTable** | Main wrapper for ALL entity tables | `entityType`, `parentType`, `parentId`, `inlineEditable`, `allowAddRow` | `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` |
| **EntityDataTable** | Auto-routed from FilteredDataTable for entities | `data`, `columns`, `inlineEditable`, `onRowClick` | `apps/web/src/components/shared/ui/EntityDataTable.tsx` |
| **SettingsDataTable** | Auto-routed from FilteredDataTable for settings | `data`, `columns`, reordering support | `apps/web/src/components/shared/ui/SettingsDataTable.tsx` |

**Usage Pattern**:
```tsx
// ✅ CORRECT: Always use FilteredDataTable
<FilteredDataTable
  entityType="task"
  parentType="project"
  parentId={projectId}
  inlineEditable={true}
  allowAddRow={true}
/>

// ❌ WRONG: Don't create custom tables
<CustomTaskTable data={tasks} />
```

---

### 2. **Visualizations** (Data Display Modes)

| Component | When to Use | Data Format | Visual Output | Location |
|-----------|-------------|-------------|---------------|----------|
| **DAGVisualizer** | Stage/funnel fields (dl__*_stage, dl__*_funnel) | `DAGNode[]` with `id, node_name, parent_ids` | Topological graph with layers, arrows, highlighted current node | `apps/web/src/components/workflow/DAGVisualizer.tsx` |
| **KanbanBoard** | Task boards, stage-based workflows | Grouped by status/stage column | Drag-drop cards across columns | `apps/web/src/components/shared/ui/KanbanBoard.tsx` |
| **CalendarView** | Person availability, event booking | Calendar slots with person entities | Weekly grid, drag-drop events, person filter | `apps/web/src/components/shared/ui/CalendarView.tsx` |
| **GridView** | Card-based entity display | Entity records | Responsive grid of cards | `apps/web/src/components/shared/ui/GridView.tsx` |
| **HierarchyGraphView** | Tree structures (office, business) | Hierarchical entity data | Interactive tree with expand/collapse | `apps/web/src/components/shared/ui/HierarchyGraphView.tsx` |

**Visualization Selection**:
```tsx
// DAG: Used in EntityFormContainer for stage fields
if (fieldKey.startsWith('dl__') && (fieldKey.includes('stage') || fieldKey.includes('funnel'))) {
  return <DAGVisualizer nodes={dagNodes} currentNodeId={value} />;
}

// Calendar: Used for person-calendar entities
<CalendarView config={config} data={calendarSlots} />

// Kanban: Used in EntityMainPage for task-like entities
<KanbanBoard entityType="task" />
```

---

### 3. **Entity Form Data Container** (Universal Form)

**Component**: `EntityFormContainer`
**Location**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Supported Field Types** (Auto-detected from entityConfig):

| Field Type | Input Component | Auto-Detection Pattern | Example Field |
|------------|-----------------|------------------------|---------------|
| **text** | `<input type="text">` | Default for string fields | `name`, `code`, `email` |
| **number** | `<input type="number">` | Fields ending in `_qty`, `_count`, `headcount` | `current_headcount` |
| **currency** | `<input type="number">` with $ prefix | Fields ending in `_amt`, `_price`, `_cost` | `budget_allocated_amt` |
| **date** | `<input type="date">` | Fields ending in `_date` | `start_date`, `end_date` |
| **datetime** | `<input type="datetime-local">` | Fields ending in `_ts`, `_at` | `created_ts`, `updated_at` |
| **select** | `<select>` with options | `loadOptionsFromSettings: true` | `dl__project_stage`, `status` |
| **multiselect** | SearchableMultiSelect | `type: 'multiselect'` | `employee_ids` |
| **tags** | Tags input | `type: 'tags'` or field name is `tags` | `tags` |
| **boolean** | Checkbox | `type: 'boolean'` | `active_flag`, `is_public` |
| **textarea** | `<textarea>` | `type: 'textarea'` or field is `descr` | `descr`, `notes` |
| **richtext** | Rich text editor (Quill Delta) | `type: 'richtext'` | `content`, `description_richtext` |
| **file** | File upload with S3 presigned URL | Fields ending in `_attachment`, `_file` | `artifact_attachment` |
| **metadata** | MetadataTable (JSONB editor) | Field name is `metadata` | `metadata` |
| **DAG** | DAGVisualizer | `dl__` prefix + `stage`/`funnel` in name | `dl__project_stage`, `dl__sales_funnel` |
| **date-range** | DateRangeVisualizer | Pair: `from_ts` + `to_ts` | `from_ts`, `to_ts` |

**Usage Pattern**:
```tsx
// ✅ CORRECT: EntityFormContainer auto-detects all field types
<EntityFormContainer
  config={config}
  data={data}
  isEditing={isEditing}
  onChange={handleChange}
  mode="edit"
/>

// Field definitions in entityConfig.ts:
fields: [
  { key: 'name', type: 'text', required: true },
  { key: 'dl__project_stage', type: 'select', loadOptionsFromSettings: true }, // Auto-renders DAG
  { key: 'budget_allocated_amt', type: 'number' }, // Auto-renders with $ prefix
  { key: 'tags', type: 'tags' },
  { key: 'metadata', type: 'metadata' } // Auto-renders JSONB editor
]
```

---

### 4. **Navigation & Tabs**

| Component | Purpose | Data Source | Usage | Location |
|-----------|---------|-------------|-------|----------|
| **DynamicChildEntityTabs** | Auto-generate child entity tabs | `/api/v1/entity/:type/children` (from `d_entity` table) | Always use in EntityDetailPage | `apps/web/src/components/shared/layout/DynamicChildEntityTabs.tsx` |
| **ViewSwitcher** | Toggle between table/kanban/grid/calendar | Config-driven | Use in EntityMainPage | `apps/web/src/components/shared/ui/ViewSwitcher.tsx` |
| **NavigationBreadcrumb** | Breadcrumb trail | Navigation history context | Use in all entity pages | `apps/web/src/components/shared/navigation/NavigationBreadcrumb.tsx` |

**Tab Pattern**:
```tsx
// ✅ CORRECT: Dynamic tabs from d_entity metadata
const { tabs } = useDynamicChildEntityTabs(entityType, id);

<DynamicChildEntityTabs
  tabs={[{ id: 'overview', label: 'Overview', path: `/${entityType}/${id}` }, ...tabs]}
  activeTab={currentTab}
/>

// ❌ WRONG: Hardcoded tabs
<Tabs>
  <Tab label="Tasks">...</Tab>
  <Tab label="Wiki">...</Tab>
</Tabs>
```

---

### 5. **Modals & Overlays**

| Component | Purpose | Usage | Location |
|-----------|---------|-------|----------|
| **EntityEditModal** | Edit entity inline in modal | Wrap EntityFormContainer | `apps/web/src/components/shared/modal/EntityEditModal.tsx` |
| **UnifiedLinkageModal** | Link entities (d_entity_id_map) | Parent-child relationships | `apps/web/src/components/shared/modal/UnifiedLinkageModal.tsx` |
| **ShareModal** | Generate share links | Public entity sharing | `apps/web/src/components/shared/modal/ShareModal.tsx` |
| **Modal** | Base modal component | Generic overlays | `apps/web/src/components/shared/ui/Modal.tsx` |

---

## 🎨 Data Visualization Matrix

| Data Type | Visualization | Component | Example Use Case |
|-----------|---------------|-----------|------------------|
| **Workflow stages** | DAG graph (nodes + arrows) | DAGVisualizer | Project stages, sales funnel, task workflow |
| **Time-based events** | Weekly calendar grid | CalendarView | Employee availability, event booking, meetings |
| **Date ranges** | Timeline bars | DateRangeVisualizer | Project validity (from_ts → to_ts) |
| **Task status** | Kanban columns | KanbanBoard | Task board, project pipeline |
| **Entity list** | Sortable table | EntityDataTable | All entity main pages |
| **Hierarchical data** | Tree view | HierarchyGraphView | Office hierarchy, business hierarchy |
| **Card layout** | Responsive grid | GridView | Project cards, employee cards |
| **JSONB data** | Editable table | MetadataTable | metadata field editing |
| **Rich text** | Quill Delta renderer | RichTextRenderer | Task updates, wiki content |

---

## 🏗️ Entity Screen Architecture

### **Universal Pages** (3 pages handle ALL 18+ entity types)

1. **EntityMainPage** (`apps/web/src/pages/shared/EntityMainPage.tsx`)
   - **Purpose**: List view for entity type
   - **Components Used**:
     - `FilteredDataTable` (primary view)
     - `ViewSwitcher` (table/kanban/grid/calendar toggle)
     - `KanbanBoard` (if view = kanban)
     - `GridView` (if view = grid)
     - `CalendarView` (if view = calendar)
   - **Features**: Add row, inline editing, bulk delete, search, filter

2. **EntityDetailPage** (`apps/web/src/pages/shared/EntityDetailPage.tsx`)
   - **Purpose**: Single entity view with child tabs
   - **Components Used**:
     - `EntityFormContainer` (form fields)
     - `DynamicChildEntityTabs` (child entity navigation)
     - `FilteredDataTable` (child entity tables)
     - `DAGVisualizer` (stage fields)
     - `DateRangeVisualizer` (date range fields)
     - `MetadataTable` (metadata field)
     - `FilePreview` (attachment fields)
   - **Features**: Edit mode, child entity tabs, linkage, share, file upload

3. **EntityFormPage** (`apps/web/src/pages/shared/EntityFormPage.tsx`)
   - **Purpose**: Create new entity
   - **Components Used**:
     - `EntityFormContainer` (same as detail page)
   - **Features**: Pre-fill parent context, create-then-link pattern

---

## 📐 Design Patterns for Entity Development

### **Pattern 1: Add New Entity Type**
```typescript
// 1. Create entityConfig entry (apps/web/src/config/entityConfigs.ts)
export const invoiceConfig: EntityConfig = {
  type: 'invoice',
  title: 'Invoice',
  apiEndpoint: '/api/v1/invoice',
  fields: [
    { key: 'name', type: 'text', required: true },
    { key: 'invoice_amt', type: 'number', required: true }, // Auto: currency input
    { key: 'dl__invoice_status', type: 'select', loadOptionsFromSettings: true }, // Auto: dropdown
    { key: 'from_ts', type: 'datetime' },
    { key: 'to_ts', type: 'datetime' } // Auto: DateRangeVisualizer
  ]
};

// 2. Add to routing (apps/web/src/App.tsx)
<Route path="/invoice" element={<EntityMainPage entityType="invoice" />} />
<Route path="/invoice/:id" element={<EntityDetailPage entityType="invoice" />} />

// 3. Done! All components auto-configured:
//    - FilteredDataTable for list view
//    - EntityFormContainer for create/edit
//    - DynamicChildEntityTabs for child entities (if any in d_entity)
//    - DAGVisualizer for stage fields
//    - All field types auto-detected
```

### **Pattern 2: Add Child Entity Tab**
```sql
-- 1. Update d_entity table to add child relationship
UPDATE app.d_entity
SET child_entities = child_entities || '[{"entity": "invoice", "ui_icon": "FileText", "ui_label": "Invoices", "order": 7}]'::jsonb
WHERE code = 'project';

-- 2. Done! DynamicChildEntityTabs auto-loads from API
-- No frontend code changes needed
```

### **Pattern 3: Add New Field Type**
```typescript
// 1. Add field to entityConfig
{ key: 'new_field', type: 'select', loadOptionsFromSettings: true }

// 2. EntityFormContainer auto-detects and renders correct input
// 3. EntityDataTable auto-enables inline editing for this field
```

---

## ✅ Mandatory Checklist for New Entity Development

- [ ] Use **FilteredDataTable** for all list views (never custom tables)
- [ ] Use **EntityFormContainer** for all forms (never custom forms)
- [ ] Use **DynamicChildEntityTabs** for child navigation (never hardcoded tabs)
- [ ] Configure fields in **entityConfig.ts** (single source of truth)
- [ ] Use **DAGVisualizer** for stage/funnel fields (`dl__*_stage`, `dl__*_funnel`)
- [ ] Use **DateRangeVisualizer** for date range pairs (`from_ts`, `to_ts`)
- [ ] Use **MetadataTable** for `metadata` JSONB field
- [ ] Use **KanbanBoard** for task-like entities (status-based workflows)
- [ ] Use **CalendarView** for time-based scheduling entities
- [ ] Enable **inline editing** by default (`inlineEditable: true`)
- [ ] Enable **add row** functionality (`allowAddRow: true`)
- [ ] Load dropdown options from **settings API** (`loadOptionsFromSettings: true`)
- [ ] Never hardcode entity icons/labels (query `d_entity` table via API)
- [ ] All parent-child relationships MUST use **UnifiedLinkageModal**
- [ ] All file uploads MUST use **S3 presigned URLs** (never direct upload)

---

## 🚨 Common Anti-Patterns (DO NOT DO)

| ❌ Anti-Pattern | ✅ Correct Pattern |
|----------------|-------------------|
| Creating custom entity-specific tables | Use FilteredDataTable with entityType prop |
| Hardcoding dropdown options in frontend | Use loadOptionsFromSettings: true |
| Custom form components per entity | Use EntityFormContainer with config |
| Hardcoding child entity tabs | Use DynamicChildEntityTabs (loads from d_entity API) |
| Direct S3 upload without presigned URL | Use useS3Upload hook with presigned URL workflow |
| Storing files in database | Store attachment metadata, files in S3/MinIO |
| Adding foreign keys to entity tables | Use d_entity_id_map for relationships |
| Creating entity-specific pages | Use EntityMainPage/EntityDetailPage with entityType |
| Manual field type detection | Use EntityFormContainer auto-detection |
| Custom workflow visualizations | Use DAGVisualizer for stages, KanbanBoard for statuses |

---

## 📚 Related Documentation

- **[DRY Factory Patterns](./entity_design_pattern/DRY_FACTORY_PATTERNS.md)** - Code generation patterns
- **[Universal Entity System](./entity_design_pattern/universal_entity_system.md)** - Complete architecture
- **[Entity Options API](./ENTITY_OPTIONS_API.md)** - Dropdown/select options
- **[S3 Attachment Service](./S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md)** - File upload patterns
- **[Data Model](./datamodel/datamodel.md)** - Database schema reference

---

**Last Updated**: 2025-11-11
**Version**: 3.1.0
**Status**: MANDATORY for all entity development
