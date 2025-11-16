# UI Components Architecture Documentation

> **Source of Truth**: Database DDL files (`db/*.ddl`), API routes (`apps/api/src/modules/*/routes.ts`), and `docs/api/entity_endpoint_design.md`

**Version**: 4.0
**Last Updated**: 2025-11-16
**Applies To**: Entity System v4.0, Universal Data Gate Pattern, Zero-Config Architecture

---

## Table of Contents

- [A. Architecture & DRY Design Patterns](#a-architecture--dry-design-patterns)
- [B. Component Hierarchy](#b-component-hierarchy)
- [C. Complete Data Flow](#c-complete-data-flow)
- [D. Backend Endpoint Interactions](#d-backend-endpoint-interactions)

---

## A. Architecture & DRY Design Patterns

### 1. Core Architectural Principles

The PMO UI component system is built on **React Composition** with **zero-config** philosophy:

```typescript
// ✅ GOOD: Zero-config entity rendering
<EntityDataTable entityType="project" />
// System automatically:
// - Detects columns from API response
// - Applies field type detection (12 patterns)
// - Renders appropriate input controls
// - Handles inline editing with RBAC

// ❌ OLD: Manual configuration (v3.x - deprecated)
<EntityDataTable
  columns={[...]}  // Not needed anymore
  fields={[...]}   // Not needed anymore
/>
```

#### 1.1 Three-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│         PRESENTATION LAYER (Universal Pages)        │
│  EntityMainPage, EntityDetailPage, EntityFormPage   │
│         ↓ Uses 5 core components ↓                  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│          COMPONENT LAYER (This Document)            │
│  EntityDataTable, KanbanBoard, DAGVisualizer,       │
│  SettingsDataTable, DynamicChildEntityTabs          │
│         ↓ Uses centralized libraries ↓              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│           CENTRALIZED LIBRARIES (DRY)               │
│  • universalFieldDetector.ts - Pattern detection    │
│  • data_transform_render.tsx - Formatting/display   │
│  • entityConfig.ts - Schema definitions (WHAT)      │
│  • settingsLoader.ts - Dynamic dropdown options     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              API LAYER (Backend)                    │
│  Universal CRUD endpoints with RBAC + Auto-filters  │
│  GET/POST/PATCH/DELETE /api/v1/{entity}             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│           DATABASE LAYER (Source of Truth)          │
│  DDL files define schema: db/d_{entity}.ddl         │
│  • Standard fields: id, code, name, descr, metadata │
│  • Temporal: from_ts, to_ts, active_flag           │
│  • Audit: created_ts, updated_ts, version          │
└─────────────────────────────────────────────────────┘
```

### 2. DRY Pattern: Centralized Field Detection

**Single Universal Field Detector** (`universalFieldDetector.ts`) with 12 auto-detection patterns:

```typescript
// Pattern Detection Examples
detectField('total_amt')           → { type: 'currency', render: formatCurrency }
detectField('dl__project_stage')   → { type: 'settings_dropdown', loadOptions: true }
detectField('is_active')           → { type: 'boolean', render: Toggle }
detectField('employee_id')         → { type: 'entity_reference', entity: 'employee' }
detectField('tags')                → { type: 'array', render: TagInput }
detectField('start_date')          → { type: 'date', render: DatePicker }
detectField('priority_pct')        → { type: 'percentage', render: '45%' }
detectField('config_json')         → { type: 'json', render: JSONEditor }
detectField('logo_url')            → { type: 'attachment', render: FileUpload }
detectField('created_ts')          → { type: 'timestamp', render: '3 days ago' }
```

**12 Detection Patterns** (from `universalFieldDetector.ts:47-93`):

| Pattern | Example Fields | Auto-Detected Type | Component |
|---------|---------------|-------------------|-----------|
| `dl__*` | `dl__task_stage`, `dl__task_priority` | Settings dropdown | `<Select>` with options API |
| `*_amt` | `budget_allocated_amt`, `total_amt` | Currency | Right-aligned, formatted |
| `*_date` | `start_date`, `due_date` | Date | `<DatePicker>` |
| `*_ts` | `created_ts`, `updated_ts` | Timestamp | Relative time ("3 days ago") |
| `is_*`, `*_flag` | `is_active`, `active_flag` | Boolean | `<Toggle>` |
| `*_id` (entity) | `project_id`, `employee_id` | Entity reference | Hidden ID + visible name |
| `tags` | `tags` | Array | `<TagInput>` |
| `*_pct` | `completion_pct`, `priority_pct` | Percentage | "45%" display |
| `*_json`, `metadata` | `config_json`, `metadata` | JSON | `<JSONEditor>` |
| `*_url` (image) | `logo_url`, `avatar_url` | Attachment | `<FileUpload>` |
| `descr`, `*_notes` | `descr`, `case_notes` | Long text | `<Textarea>` |
| Default | `name`, `code` | Short text | `<Input>` |

### 3. DRY Pattern: Centralized Data Transformation

**Single Transformation Library** (`data_transform_render.tsx`) handles ALL data formatting:

```typescript
// Import once, use everywhere
import {
  transformForApi,      // Frontend → API
  formatRelativeTime,   // Timestamps
  formatCurrency,       // Money
  getFieldCapability    // Auto-detect editability
} from './data_transform_render';

// Used by ALL components
const apiData = transformForApi(formData);  // "2024-10-28" → ISO timestamp
const display = formatRelativeTime(row.created_ts);  // → "3 days ago"
const capability = getFieldCapability({ key: 'budget_amt' });  // → { inlineEditable: true }
```

**Centralized = NO duplication** across 5+ components:
- EntityDataTable uses it
- SettingsDataTable uses it
- EntityFormContainer uses it
- EntityDetailPage uses it
- KanbanBoard uses it

### 4. DRY Pattern: React Composition

**Component Reuse via Composition**:

```typescript
// EntityDataTable composes smaller components
<EntityDataTable>
  <DataTableHeader>           // Filters, search, view modes
    <ViewModeToggle />        // Table/Kanban/Calendar switch
    <SearchInput />
    <FilterBar />
  </DataTableHeader>

  <DataTableBody>             // Core table rendering
    {rows.map(row => (
      <DataTableRow>
        {columns.map(col => (
          <DataTableCell>
            {renderCellValue(row, col)}  // Auto-detects field type
          </DataTableCell>
        ))}
      </DataTableRow>
    ))}
  </DataTableBody>

  <DataTableFooter>           // Pagination
    <Pagination total={total} limit={limit} />
  </DataTableFooter>
</EntityDataTable>
```

**Shared Subcomponents** (used by multiple parents):
- `<Pagination>` - Used by EntityDataTable, SettingsDataTable
- `<ViewModeToggle>` - Used by EntityMainPage
- `<SearchInput>` - Used by EntityDataTable, SettingsDataTable
- `<InlineEditCell>` - Used by EntityDataTable (auto-renders based on field type)

### 5. Configuration-Driven UI

**Minimal Config in `entityConfig.ts`**:

```typescript
export const entityConfigs = {
  project: {
    name: 'project',
    displayName: 'Project',
    apiEndpoint: '/api/v1/project',

    // ✅ Zero-config (v4.0) - columns auto-generated from API response
    columns: [],

    // ✅ Zero-config (v4.0) - fields auto-detected from column patterns
    fields: [],

    // Optional: View modes
    views: {
      table: { enabled: true, default: true },
      kanban: { enabled: true, statusField: 'dl__project_stage' },
      calendar: { enabled: false }
    }
  }
};
```

**What gets auto-generated**:
1. **Columns** - Detected from first API response
2. **Field types** - Pattern-matched via universalFieldDetector
3. **Render functions** - Applied from data_transform_render
4. **Editability** - Determined by field name patterns
5. **Dropdown options** - Loaded from `/api/v1/entity/:type/options`

### 6. RBAC-Aware Components

**All components respect row-level security**:

```typescript
// API applies RBAC filtering automatically
GET /api/v1/project
→ Returns only projects user can VIEW

// Component receives pre-filtered data
<EntityDataTable data={projects} />  // User already authorized

// Inline editing checks permissions
const canEdit = await checkPermission(userId, 'project', projectId, Permission.EDIT);
if (!canEdit) {
  return <span>{value}</span>;  // Read-only display
}
return <InlineEditCell value={value} />;  // Editable
```

**Permission checks happen at**:
1. **API layer** (primary) - Filters data before sending
2. **Component layer** (secondary) - Disables edit controls
3. **UI layer** (tertiary) - Hides action buttons

---

## B. Component Hierarchy

### Overview of 5 Core Components

```
Universal Pages (3)
├── EntityMainPage.tsx
│   ├── EntityDataTable ────────────── (1) Primary data table
│   ├── KanbanBoard ────────────────── (2) Kanban workflow view
│   └── DAGVisualizer ──────────────── (3) Workflow graph
│
├── EntityDetailPage.tsx
│   └── DynamicChildEntityTabs ─────── (4) Parent-child tabs
│
└── SettingsPage.tsx
    └── SettingsDataTable ──────────── (5) Settings management
```

---

### Component 1: EntityDataTable

**Purpose**: Universal data table for entity CRUD with inline editing, filtering, and multi-view modes

**Location**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Component Tree**:

```
<EntityDataTable>
├── <div className="entity-data-table-header">
│   ├── <SearchInput />
│   ├── <ViewModeToggle />
│   └── <FilterBar>
│       ├── <Select> (for dl__* fields - settings dropdowns)
│       ├── <Input> (for search fields)
│       └── <DateRangePicker> (for date fields)
│
├── <table className="data-table">
│   ├── <thead>
│   │   └── <tr>
│   │       ├── <th> (sortable headers)
│   │       └── <th> (action column)
│   │
│   └── <tbody>
│       └── {data.map(row => (
│           <tr key={row.id}>
│               ├── <td> → renderCellValue(row, column)
│               │   ├── Currency: <span className="currency">$1,234.56</span>
│               │   ├── Date: <span>Oct 28, 2024</span>
│               │   ├── Boolean: <Toggle checked={value} />
│               │   ├── Settings: <Badge color={getColor(value)}>{value}</Badge>
│               │   ├── Array: <TagList tags={value} />
│               │   └── Text: <InlineEditCell value={value} />
│               │
│               └── <td className="actions">
│                   ├── <Button onClick={handleView}>View</Button>
│                   ├── <Button onClick={handleEdit}>Edit</Button>
│                   └── <Button onClick={handleDelete}>Delete</Button>
│
└── <DataTableFooter>
    └── <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={handlePageChange} />
```

**Key Features**:
- **Auto-column detection** from API response
- **Inline editing** for editable fields (RBAC-checked)
- **Multi-view modes**: Table, Kanban, Calendar (if enabled)
- **Advanced filtering**: Search, date ranges, status dropdowns
- **Sorting**: Click column headers
- **Pagination**: Server-side with limit/offset

**Props**:

```typescript
interface EntityDataTableProps {
  entityType: string;           // 'project', 'task', 'employee'
  parentType?: string;          // For filtered views
  parentId?: string;            // For parent-child context
  inlineEdit?: boolean;         // Enable inline editing (default: true)
  canCreate?: boolean;          // Show create button (default: true)
  viewModes?: ViewMode[];       // ['table', 'kanban', 'calendar']
  defaultView?: ViewMode;       // 'table' (default)
}
```

---

### Component 2: SettingsDataTable

**Purpose**: Specialized table for settings entities (datalabel tables) with drag-drop reordering and color badges

**Location**: `apps/web/src/components/shared/ui/SettingsDataTable.tsx`

**Component Tree**:

```
<SettingsDataTable>
├── <div className="settings-header">
│   ├── <h2>{entityConfig.displayName}</h2>
│   ├── <SearchInput />
│   └── <Button onClick={handleCreate}>Add New</Button>
│
├── <DragDropContext onDragEnd={handleReorder}>
│   <table className="settings-table">
│   ├── <thead>
│   │   └── <tr>
│   │       ├── <th>Drag Handle</th>
│   │       ├── <th>Code</th>
│   │       ├── <th>Name</th>
│   │       ├── <th>Color</th>
│   │       ├── <th>Order</th>
│   │       └── <th>Actions</th>
│   │
│   └── <Draggable items={settings}>
│       {settings.map(item => (
│         <tr key={item.id} draggable>
│           ├── <td><DragHandle /></td>
│           ├── <td><InlineEditCell value={item.code} /></td>
│           ├── <td><InlineEditCell value={item.name} /></td>
│           ├── <td><ColorPicker value={item.color_code} /></td>
│           ├── <td>{item.display_order}</td>
│           └── <td>
│               ├── <Button onClick={handleEdit}>Edit</Button>
│               └── <Button onClick={handleDelete}>Delete</Button>
│       ))}
│   </Draggable>
│   </table>
│
└── <Pagination />
```

**Key Differences from EntityDataTable**:
- **Drag-drop reordering** (updates `display_order` field)
- **Color badge management** (`color_code` field with color picker)
- **Simplified columns** (code, name, color, order, active)
- **No view mode switching** (always table view)
- **Auto-save on reorder** (optimistic UI update)

**Props**:

```typescript
interface SettingsDataTableProps {
  settingsType: string;         // 'task_stage', 'task_priority', 'project_stage'
  canReorder?: boolean;         // Enable drag-drop (default: true)
  showColorPicker?: boolean;    // Show color column (default: true)
}
```

---

### Component 3: KanbanBoard

**Purpose**: Kanban view for workflow stages with drag-drop card management

**Location**: `apps/web/src/components/shared/ui/KanbanBoard.tsx`

**Component Tree**:

```
<KanbanBoard>
├── <div className="kanban-header">
│   ├── <h2>{entityConfig.displayName} Kanban</h2>
│   ├── <FilterBar>
│   │   ├── <Select label="Assignee" />
│   │   └── <Select label="Priority" />
│   └── <Button onClick={switchToTable}>Table View</Button>
│
└── <DragDropContext onDragEnd={handleCardMove}>
    <div className="kanban-columns">
    {columns.map(column => (
      <div key={column.id} className="kanban-column">
        ├── <div className="column-header">
        │   ├── <Badge color={column.color}>{column.name}</Badge>
        │   └── <span className="count">{column.items.length}</span>
        │
        └── <Droppable droppableId={column.id}>
            <div className="card-list">
            {column.items.map(card => (
              <Draggable key={card.id} draggableId={card.id}>
                <KanbanCard>
                  ├── <h4>{card.name}</h4>
                  ├── <p>{card.descr}</p>
                  ├── <div className="card-meta">
                  │   ├── <Badge>{card.priority}</Badge>
                  │   ├── <Avatar src={card.assignee_avatar} />
                  │   └── <span>{formatRelativeTime(card.updated_ts)}</span>
                  │
                  └── <div className="card-actions">
                      ├── <Button onClick={handleView}>View</Button>
                      └── <Button onClick={handleEdit}>Edit</Button>
                </KanbanCard>
              </Draggable>
            ))}
            </div>
        </Droppable>
      </div>
    ))}
    </div>
</DragDropContext>
```

**Status Field Detection**:

```typescript
// Auto-detects status field from entity config
const statusField = entityConfig.views?.kanban?.statusField || 'dl__task_stage';

// Loads column definitions from settings API
GET /api/v1/entity/task/options
→ { dl__task_stage: [
    { code: 'backlog', name: 'Backlog', color_code: '#gray' },
    { code: 'in_progress', name: 'In Progress', color_code: '#blue' },
    { code: 'done', name: 'Done', color_code: '#green' }
  ]}
```

**Drag-Drop Flow**:

```typescript
// 1. User drags card from column A to column B
onDragEnd(result) {
  const { source, destination, draggableId } = result;

  // 2. Optimistic UI update
  const updatedColumns = moveCard(columns, source, destination);
  setColumns(updatedColumns);

  // 3. API call to update status
  PATCH /api/v1/task/${draggableId}/status
  Body: {
    task_status: destination.droppableId,  // New column ID
    position: destination.index,           // New position
    moved_by: userId
  }

  // 4. Refetch to confirm or rollback on error
  if (error) {
    refetch();  // Rollback to server state
  }
}
```

**Props**:

```typescript
interface KanbanBoardProps {
  entityType: string;           // 'task', 'project'
  statusField: string;          // 'dl__task_stage' (auto-detected)
  parentType?: string;          // For filtered kanban (e.g., project tasks)
  parentId?: string;
  groupBy?: string;             // 'assignee', 'priority' (future)
}
```

---

### Component 4: DAGVisualizer

**Purpose**: Directed Acyclic Graph visualization for workflow stages with Mermaid.js

**Location**: `apps/web/src/components/workflow/DAGVisualizer.tsx`

**Component Tree**:

```
<DAGVisualizer>
├── <div className="dag-header">
│   ├── <h3>Workflow: {workflowName}</h3>
│   ├── <Select onChange={handleZoom}>
│   │   ├── <option>50%</option>
│   │   ├── <option>100%</option>
│   │   └── <option>150%</option>
│   └── <Button onClick={handleExport}>Export PNG</Button>
│
├── <div className="dag-container">
│   └── <Mermaid chart={mermaidDefinition}>
│       {/* Rendered by Mermaid.js */}
│       graph TD
│         A[Backlog] -->|Start| B[In Progress]
│         B -->|Complete| C[Done]
│         B -->|Block| D[Blocked]
│         D -->|Resolve| B
│
└── <div className="dag-legend">
    ├── <div className="legend-item">
    │   ├── <div className="color-box" style={{ background: '#blue' }} />
    │   └── <span>In Progress</span>
    ├── <div className="legend-item">
    │   ├── <div className="color-box" style={{ background: '#green' }} />
    │   └── <span>Completed</span>
    └── <div className="legend-item">
        ├── <div className="color-box" style={{ background: '#red' }} />
        └── <span>Blocked</span>
```

**Mermaid Definition Generation**:

```typescript
// Auto-generates Mermaid syntax from settings table
function generateMermaidDAG(stages: SettingOption[]): string {
  const nodes = stages.map(s => `${s.code}["${s.name}"]`);
  const edges = stages.flatMap((s, i) => {
    const nextStages = stages.slice(i + 1, i + 3);  // Connect to next 2
    return nextStages.map(next => `${s.code} --> ${next.code}`);
  });

  return `
    graph TD
    ${nodes.join('\n    ')}
    ${edges.join('\n    ')}
  `;
}

// Example output
graph TD
  backlog["Backlog"]
  in_progress["In Progress"]
  done["Done"]

  backlog --> in_progress
  in_progress --> done
```

**Props**:

```typescript
interface DAGVisualizerProps {
  entityType: string;           // 'task', 'project'
  workflowField: string;        // 'dl__task_stage'
  highlightStage?: string;      // Current entity's stage (highlighted)
  interactive?: boolean;        // Click nodes to filter (default: false)
}
```

---

### Component 5: DynamicChildEntityTabs

**Purpose**: Renders child entity tabs dynamically from `d_entity.child_entities` metadata

**Location**: `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

**Component Tree**:

```
<DynamicChildEntityTabs>
├── <div className="tabs-header">
│   {childEntities.map(childType => (
│     <Tab
│       key={childType}
│       active={activeTab === childType}
│       onClick={() => setActiveTab(childType)}
│     >
│       {childType} <Badge>{counts[childType]}</Badge>
│     </Tab>
│   ))}
│   └── <Button onClick={handleCreate}>
│         + Create {activeTab}
│       </Button>
│
└── <div className="tab-content">
    {activeTab === 'project' && (
      <EntityDataTable
        entityType="project"
        parentType="business"
        parentId={businessId}
        inlineEdit={true}
        canCreate={canCreateProject}
      />
    )}
    {activeTab === 'employee' && (
      <EntityDataTable
        entityType="employee"
        parentType="business"
        parentId={businessId}
      />
    )}
    {/* ... other child tabs ... */}
```

**Metadata-Driven Tabs**:

```sql
-- Source of truth: d_entity table
SELECT child_entities FROM app.d_entity WHERE code = 'business';
→ ['project', 'employee', 'client']

-- API endpoint returns counts
GET /api/v1/business/:id/dynamic-child-entity-tabs
→ {
  tabs: [
    { entity_type: 'project', count: 12 },
    { entity_type: 'employee', count: 45 },
    { entity_type: 'client', count: 8 }
  ]
}
```

**Props**:

```typescript
interface DynamicChildEntityTabsProps {
  parentType: string;           // 'business', 'project', 'office'
  parentId: string;             // UUID of parent entity
  defaultTab?: string;          // Initial active tab (first child by default)
}
```

---

## C. Complete Data Flow

### Flow 1: List Entities (EntityDataTable)

**User Action**: Navigate to `/project` (project list page)

**Data Flow**:

```
1. PAGE LOAD
   EntityMainPage.tsx
   └── <EntityDataTable entityType="project" />

2. INITIAL DATA FETCH
   EntityDataTable (useEffect)
   ├── const config = entityConfigs['project']
   ├── API: GET /api/v1/project?limit=50&offset=0
   │   └── Backend: apps/api/src/modules/project/routes.ts
   │       ├── RBAC filtering (unified_data_gate.rbac_gate)
   │       │   SELECT id FROM entity_id_rbac_map
   │       │   WHERE person_entity_id = {userId}
   │       │     AND entity_name = 'project'
   │       │     AND permission >= 0  -- VIEW permission
   │       │
   │       ├── Auto-filters (buildAutoFilters)
   │       │   WHERE active_flag = true  -- Default filter
   │       │
   │       ├── Query execution
   │       │   SELECT p.*,
   │       │          (p.metadata->>'business_id') as business_id,
   │       │          b.name as business_name
   │       │   FROM app.d_project p
   │       │   LEFT JOIN app.d_business b ON b.id = (p.metadata->>'business_id')::uuid
   │       │   WHERE p.id = ANY({accessible_ids})
   │       │     AND p.active_flag = true
   │       │   LIMIT 50 OFFSET 0
   │       │
   │       └── Response: { data: [...], total: 145, limit: 50, offset: 0 }
   │
   └── State update: setData(response.data)

3. COLUMN DETECTION (First Render)
   EntityDataTable (renderCellValue)
   ├── Iterate API response fields
   ├── For each field:
   │   ├── universalFieldDetector(fieldKey)
   │   │   ├── 'budget_allocated_amt' → CURRENCY
   │   │   ├── 'dl__project_stage' → SETTINGS_DROPDOWN
   │   │   ├── 'start_date' → DATE
   │   │   └── 'business_name' → TEXT (entity lookup)
   │   │
   │   └── Apply render function from data_transform_render
   │       ├── formatCurrency(value, currency)
   │       ├── <Badge color={getSettingColor(value)} />
   │       ├── formatDate(value)
   │       └── <span>{value}</span>
   │
   └── Render table with detected columns

4. LOAD DROPDOWN OPTIONS (for dl__* fields)
   settingsLoader (useEffect)
   ├── API: GET /api/v1/entity/project/options
   │   └── Backend: apps/api/src/modules/entity/routes.ts
   │       SELECT DISTINCT code, name, color_code, display_order
   │       FROM app.setting_datalabel_project_stage
   │       WHERE active_flag = true
   │       ORDER BY display_order
   │
   └── Cache in state: setOptions({ dl__project_stage: [...] })

5. USER INTERACTION: Filter by Status
   User clicks: Filter → "Stage: In Progress"
   ├── Update query params: ?dl__project_stage=in_progress
   ├── Refetch with filter:
   │   API: GET /api/v1/project?dl__project_stage=in_progress&limit=50&offset=0
   │   └── Backend applies auto-filter:
   │       WHERE p.dl__project_stage = 'in_progress'
   │         AND p.id = ANY({accessible_ids})
   │         AND p.active_flag = true
   │
   └── Re-render table with filtered data

6. USER INTERACTION: Inline Edit
   User double-clicks "Budget" cell → $50,000
   ├── Check editability: getFieldCapability('budget_allocated_amt')
   │   → { inlineEditable: true, editType: 'currency' }
   │
   ├── Render input: <CurrencyInput value={50000} />
   ├── User changes to: $75,000
   ├── On blur / Enter:
   │   ├── Transform: transformForApi({ budget_allocated_amt: '75000' })
   │   ├── API: PATCH /api/v1/project/{id}
   │   │   Body: { budget_allocated_amt: 75000 }
   │   │   └── Backend:
   │   │       ├── RBAC check: unified_data_gate.rbac_gate.checkPermission
   │   │       │   (userId, 'project', projectId, Permission.EDIT)
   │   │       │
   │   │       ├── Update query:
   │   │       │   UPDATE app.d_project
   │   │       │   SET budget_allocated_amt = 75000,
   │   │       │       updated_ts = NOW()
   │   │       │   WHERE id = {projectId}
   │   │       │   RETURNING *
   │   │       │
   │   │       └── Response: { ...updated_project }
   │   │
   │   └── Optimistic UI update → Refetch to confirm

7. USER INTERACTION: Sort by Column
   User clicks: "Budget" column header
   ├── Update sort state: { field: 'budget_allocated_amt', order: 'desc' }
   ├── Client-side sort (data already loaded)
   │   const sorted = [...data].sort((a, b) =>
   │     b.budget_allocated_amt - a.budget_allocated_amt
   │   );
   └── Re-render with sorted data
```

---

### Flow 2: Create Entity with Parent Context

**User Action**: Click "Create Task" from Project detail page

**Data Flow**:

```
1. PARENT CONTEXT
   EntityDetailPage (Project #abc123)
   └── <Button onClick={handleCreateTask}>+ Create Task</Button>
       └── Navigate to: /task/create?parent_type=project&parent_id=abc123

2. FORM INITIALIZATION
   EntityFormPage
   ├── Parse query params: { parent_type: 'project', parent_id: 'abc123' }
   ├── Load entity config: entityConfigs['task']
   ├── Auto-detect fields from config
   │   └── universalFieldDetector for each field
   │       ├── 'name' → TEXT_INPUT
   │       ├── 'dl__task_stage' → SETTINGS_DROPDOWN
   │       ├── 'estimated_hours' → NUMBER_INPUT
   │       └── 'assigned_to_employee_id' → ENTITY_REFERENCE_SELECT
   │
   └── Load dropdown options:
       API: GET /api/v1/entity/task/options
       → { dl__task_stage: [...], dl__task_priority: [...] }

3. USER FILLS FORM
   <EntityFormContainer>
   ├── Name: "Fix login bug"
   ├── Stage: "backlog" (from dropdown)
   ├── Priority: "high" (from dropdown)
   ├── Estimated Hours: 8
   └── Assigned To: "John Doe" (employee lookup)

4. FORM SUBMISSION
   handleSubmit(formData)
   ├── Transform for API:
   │   transformForApi({
   │     name: "Fix login bug",
   │     dl__task_stage: "backlog",
   │     dl__task_priority: "high",
   │     estimated_hours: 8,
   │     metadata: { project_id: "abc123" }  // Parent context embedded
   │   })
   │
   ├── API: POST /api/v1/task
   │   Body: {
   │     name: "Fix login bug",
   │     code: "TASK-1731763200",  // Auto-generated
   │     dl__task_stage: "backlog",
   │     dl__task_priority: "high",
   │     estimated_hours: 8,
   │     metadata: { project_id: "abc123" }
   │   }
   │   └── Backend: apps/api/src/modules/task/routes.ts
   │       ├── RBAC check: Can user CREATE tasks?
   │       │   unified_data_gate.rbac_gate.checkPermission
   │       │   (userId, 'task', ALL_ENTITIES_ID, Permission.CREATE)
   │       │
   │       ├── Insert task:
   │       │   INSERT INTO app.d_task (...) VALUES (...)
   │       │   RETURNING *
   │       │   → newTask = { id: "def456", ... }
   │       │
   │       ├── Register in entity registry:
   │       │   INSERT INTO app.d_entity_instance_id
   │       │   (entity_type, entity_id, entity_name, entity_code)
   │       │   VALUES ('task', 'def456', 'Fix login bug', 'TASK-1731763200')
   │       │
   │       └── Response: { id: "def456", ... }
   │
   └── Navigate to: /task/def456 (detail page)

5. LINKING TO PARENT (Automatic via Frontend)
   EntityFormPage (after create success)
   ├── If parent_type && parent_id:
   │   API: POST /api/v1/linkage
   │   Body: {
   │     parent_entity_type: "project",
   │     parent_entity_id: "abc123",
   │     child_entity_type: "task",
   │     child_entity_id: "def456",
   │     relationship_type: "contains"
   │   }
   │   └── Backend: linkage.service.js (createLinkage)
   │       ├── Check for existing linkage:
   │       │   SELECT id FROM app.d_entity_id_map
   │       │   WHERE parent_entity_type = 'project'
   │       │     AND parent_entity_id = 'abc123'
   │       │     AND child_entity_type = 'task'
   │       │     AND child_entity_id = 'def456'
   │       │
   │       ├── If exists and inactive → reactivate:
   │       │   UPDATE app.d_entity_id_map
   │       │   SET active_flag = true
   │       │   WHERE id = {linkage_id}
   │       │
   │       ├── Else create new:
   │       │   INSERT INTO app.d_entity_id_map (...)
   │       │   VALUES ('project', 'abc123', 'task', 'def456', 'contains')
   │       │
   │       └── Response: { success: true, linkage_id: "..." }
   │
   └── Show success toast: "Task created and linked to project"

6. ASSIGN EMPLOYEE (Additional Step)
   EntityFormPage (if assignee selected)
   ├── API: POST /api/v1/linkage
   │   Body: {
   │     parent_entity_type: "task",
   │     parent_entity_id: "def456",
   │     child_entity_type: "employee",
   │     child_entity_id: "john-uuid",
   │     relationship_type: "assigned_to"
   │   }
   │   └── Backend: Creates employee → task linkage
   │
   └── Show toast: "John Doe assigned to task"
```

---

### Flow 3: Kanban Drag-Drop

**User Action**: Drag task card from "In Progress" to "Done"

**Data Flow**:

```
1. KANBAN INITIALIZATION
   EntityMainPage (view mode: 'kanban')
   └── <KanbanBoard entityType="task" statusField="dl__task_stage" />
       ├── Fetch column definitions:
       │   API: GET /api/v1/entity/task/options
       │   → { dl__task_stage: [
       │       { code: 'backlog', name: 'Backlog', color_code: '#gray' },
       │       { code: 'in_progress', name: 'In Progress', color_code: '#blue' },
       │       { code: 'done', name: 'Done', color_code: '#green' }
       │     ]}
       │
       ├── Fetch tasks:
       │   API: GET /api/v1/project/abc123/tasks/kanban
       │   → Backend: apps/api/src/modules/task/routes.ts
       │       SELECT t.*
       │       FROM app.d_task t
       │       WHERE (t.metadata->>'project_id')::uuid = 'abc123'
       │         AND t.id = ANY({accessible_task_ids})  -- RBAC filtered
       │         AND t.active_flag = true
       │       ORDER BY
       │         CASE t.dl__task_stage
       │           WHEN 'backlog' THEN 1
       │           WHEN 'in_progress' THEN 2
       │           WHEN 'done' THEN 3
       │         END,
       │         (t.metadata->>'kanban_position')::int,
       │         t.created_ts
       │
       │   → Response: {
       │       project: { id: 'abc123', name: 'Website Redesign' },
       │       columns: {
       │         backlog: [task1, task2],
       │         in_progress: [task3, task4],  // task4 = "Fix login bug"
       │         done: [task5]
       │       },
       │       stats: { total: 5, by_status: {...} }
       │     }
       │
       └── Render columns with cards

2. USER DRAGS CARD
   <DragDropContext onDragEnd={handleDragEnd}>
   Event: {
     draggableId: "task4-id",          // Task being moved
     source: {
       droppableId: "in_progress",     // Source column
       index: 1                         // Position in source
     },
     destination: {
       droppableId: "done",             // Destination column
       index: 0                         // New position
     }
   }

3. OPTIMISTIC UI UPDATE
   handleDragEnd(result)
   ├── Validate drop (check if destination exists)
   ├── Calculate new state:
   │   const newColumns = {
   │     ...columns,
   │     in_progress: columns.in_progress.filter(t => t.id !== task4.id),
   │     done: [task4, ...columns.done]  // Add to top of "Done"
   │   };
   │
   ├── Update state immediately (optimistic):
   │   setColumns(newColumns);
   │
   └── UI instantly reflects change (card moves to "Done" column)

4. API UPDATE
   handleDragEnd → API call
   ├── API: PATCH /api/v1/task/task4-id/status
   │   Body: {
   │     task_status: "done",           // New status
   │     position: 0,                   // New position in column
   │     moved_by: userId
   │   }
   │   └── Backend: apps/api/src/modules/task/routes.ts
   │       ├── RBAC check: Can user EDIT this task?
   │       │   unified_data_gate.rbac_gate.checkPermission
   │       │   (userId, 'task', 'task4-id', Permission.EDIT)
   │       │
   │       ├── Validate task exists:
   │       │   SELECT id FROM app.d_task
   │       │   WHERE id = 'task4-id' AND active_flag = true
   │       │
   │       ├── Update status with audit metadata:
   │       │   UPDATE app.d_task
   │       │   SET dl__task_stage = 'done',
   │       │       updated_ts = NOW(),
   │       │       metadata = metadata || jsonb_build_object(
   │       │         'kanban_moved_at', NOW()::text,
   │       │         'kanban_moved_by', userId,
   │       │         'kanban_position', 0
   │       │       )
   │       │   WHERE id = 'task4-id'
   │       │   RETURNING id, dl__task_stage, updated_ts
   │       │
   │       └── Response: {
   │           id: "task4-id",
   │           task_status: "done",
   │           updated: "2025-11-16T10:30:00Z"
   │         }
   │
   └── Success: Toast notification "Task moved to Done"

5. ERROR HANDLING (if API fails)
   catch (error) {
     ├── Rollback optimistic update:
     │   setColumns(previousColumns);  // Restore original state
     │
     ├── Show error toast: "Failed to move task"
     │
     └── Optionally refetch to ensure UI matches server:
         refetchKanbanData();
   }

6. REFETCH FOR CONFIRMATION
   useQuery (refetch interval: 30s)
   ├── API: GET /api/v1/project/abc123/tasks/kanban
   ├── Compare with local state
   └── If mismatch (e.g., another user moved card):
       └── Update UI with server state
```

---

### Flow 4: Parent-Child Tab Navigation

**User Action**: View business detail page → Click "Projects" tab

**Data Flow**:

```
1. PARENT ENTITY LOAD
   EntityDetailPage
   ├── URL: /business/xyz789
   ├── API: GET /api/v1/business/xyz789
   │   └── Response: { id: "xyz789", name: "Operations Division", ... }
   │
   └── Render detail view

2. CHILD TAB METADATA
   <DynamicChildEntityTabs parentType="business" parentId="xyz789" />
   ├── API: GET /api/v1/business/xyz789/dynamic-child-entity-tabs
   │   └── Backend: apps/api/src/modules/business/routes.ts
   │       ├── RBAC check: Can user VIEW this business?
   │       │   unified_data_gate.rbac_gate.checkPermission
   │       │   (userId, 'business', 'xyz789', Permission.VIEW)
   │       │
   │       ├── Get child entity types:
   │       │   SELECT child_entities FROM app.d_entity
   │       │   WHERE code = 'business' AND active_flag = true
   │       │   → child_entities = ['project', 'employee', 'client']
   │       │
   │       ├── Count children for each type:
   │       │   SELECT COUNT(*) FROM app.d_entity_id_map
   │       │   WHERE parent_entity_type = 'business'
   │       │     AND parent_entity_id = 'xyz789'
   │       │     AND child_entity_type = 'project'
   │       │     AND active_flag = true
   │       │   → project count = 12
   │       │
   │       │   (Repeat for employee, client)
   │       │
   │       └── Response: {
   │           tabs: [
   │             { entity_type: 'project', count: 12 },
   │             { entity_type: 'employee', count: 45 },
   │             { entity_type: 'client', count: 8 }
   │           ]
   │         }
   │
   └── Render tabs: Projects (12) | Employees (45) | Clients (8)

3. USER CLICKS "PROJECTS" TAB
   setActiveTab('project')
   └── Render child entity table:
       <EntityDataTable
         entityType="project"
         parentType="business"
         parentId="xyz789"
       />

4. CHILD ENTITY LOAD (Filtered by Parent)
   EntityDataTable (useEffect)
   ├── API: GET /api/v1/project?parent_type=business&parent_id=xyz789&limit=50
   │   └── Backend: apps/api/src/modules/project/routes.ts
   │       ├── RBAC filtering:
   │       │   unified_data_gate.rbac_gate.getWhereCondition
   │       │   (userId, 'project', Permission.VIEW, 'p')
   │       │   → WHERE p.id = ANY({accessible_project_ids})
   │       │
   │       ├── Parent-child filtering:
   │       │   unified_data_gate.parent_child_filtering_gate.getJoinClause
   │       │   ('project', 'business', 'xyz789', 'p')
   │       │   → JOIN app.d_entity_id_map map
   │       │       ON map.parent_entity_type = 'business'
   │       │      AND map.parent_entity_id = 'xyz789'
   │       │      AND map.child_entity_type = 'project'
   │       │      AND map.child_entity_id = p.id
   │       │      AND map.active_flag = true
   │       │
   │       ├── Combined query:
   │       │   SELECT DISTINCT p.*
   │       │   FROM app.d_project p
   │       │   JOIN app.d_entity_id_map map
   │       │     ON map.child_entity_id = p.id
   │       │    AND map.parent_entity_id = 'xyz789'
   │       │    AND map.parent_entity_type = 'business'
   │       │    AND map.child_entity_type = 'project'
   │       │    AND map.active_flag = true
   │       │   WHERE p.id = ANY({accessible_project_ids})
   │       │     AND p.active_flag = true
   │       │   LIMIT 50 OFFSET 0
   │       │
   │       └── Response: {
   │           data: [project1, project2, ...],
   │           total: 12,
   │           limit: 50,
   │           offset: 0,
   │           appliedFilters: { rbac: true, parent: true }
   │         }
   │
   └── Render table with 12 projects linked to this business

5. USER CLICKS "CREATE PROJECT"
   <Button onClick={handleCreate}>+ Create Project</Button>
   ├── Navigate to: /project/create?parent_type=business&parent_id=xyz789
   ├── EntityFormPage loads with parent context
   ├── User fills form → Submit
   ├── API: POST /api/v1/project
   │   Body: { name: "New Website", ... }
   │   → Creates project
   │
   ├── API: POST /api/v1/linkage
   │   Body: {
   │     parent_entity_type: "business",
   │     parent_entity_id: "xyz789",
   │     child_entity_type: "project",
   │     child_entity_id: "{new-project-id}",
   │     relationship_type: "contains"
   │   }
   │   → Links project to business
   │
   └── Refetch tab:
       ├── Tab count updates: Projects (13)
       └── Table shows new project in list
```

---

### Flow 5: Settings Management (SettingsDataTable)

**User Action**: Navigate to Settings → Project Stages → Reorder items

**Data Flow**:

```
1. SETTINGS PAGE LOAD
   SettingsOverviewPage
   └── Navigate to: /settings/project_stage

2. SETTINGS DATA TABLE LOAD
   <SettingsDataTable settingsType="project_stage" />
   ├── API: GET /api/v1/datalabel/project_stage?limit=100
   │   └── Backend: apps/api/src/modules/datalabel/routes.ts
   │       SELECT id, code, name, color_code, display_order, active_flag
   │       FROM app.setting_datalabel_project_stage
   │       WHERE active_flag = true
   │       ORDER BY display_order ASC
   │
   │   → Response: {
   │       data: [
   │         { id: 1, code: 'planning', name: 'Planning', color_code: '#gray', display_order: 1 },
   │         { id: 2, code: 'active', name: 'Active', color_code: '#blue', display_order: 2 },
   │         { id: 3, code: 'on_hold', name: 'On Hold', color_code: '#yellow', display_order: 3 },
   │         { id: 4, code: 'completed', name: 'Completed', color_code: '#green', display_order: 4 }
   │       ],
   │       total: 4
   │     }
   │
   └── Render draggable table

3. USER DRAGS "On Hold" TO POSITION 1
   <DragDropContext onDragEnd={handleReorder}>
   Event: {
     draggableId: "3",              // "On Hold" item
     source: { index: 2 },          // Position 3 (0-indexed)
     destination: { index: 0 }      // Position 1 (0-indexed)
   }

4. OPTIMISTIC REORDER
   handleReorder(result)
   ├── Calculate new order:
   │   const reordered = [...settings];
   │   const [moved] = reordered.splice(2, 1);  // Remove from index 2
   │   reordered.splice(0, 0, moved);           // Insert at index 0
   │
   │   // Update display_order for all items
   │   const updated = reordered.map((item, index) => ({
   │     ...item,
   │     display_order: index + 1
   │   }));
   │
   ├── Update state (optimistic):
   │   setSettings(updated);
   │
   └── UI instantly reflects new order

5. API BATCH UPDATE
   handleReorder → API call
   ├── API: PATCH /api/v1/datalabel/project_stage/reorder
   │   Body: {
   │     items: [
   │       { id: 3, display_order: 1 },  // "On Hold" moved to top
   │       { id: 1, display_order: 2 },  // "Planning" moved down
   │       { id: 2, display_order: 3 },  // "Active" moved down
   │       { id: 4, display_order: 4 }   // "Completed" unchanged
   │     ]
   │   }
   │   └── Backend:
   │       ├── Transaction start
   │       ├── For each item:
   │       │   UPDATE app.setting_datalabel_project_stage
   │       │   SET display_order = {new_order},
   │       │       updated_ts = NOW()
   │       │   WHERE id = {item_id}
   │       │
   │       ├── Transaction commit
   │       └── Response: { success: true, updated: 4 }
   │
   └── Success: Toast "Order saved"

6. INLINE EDIT COLOR
   User double-clicks color cell → Color picker opens
   ├── User selects new color: #orange
   ├── On change:
   │   API: PATCH /api/v1/datalabel/project_stage/3
   │   Body: { color_code: '#orange' }
   │   └── Backend:
   │       UPDATE app.setting_datalabel_project_stage
   │       SET color_code = '#orange'
   │       WHERE id = 3
   │       RETURNING *
   │
   └── Update UI: "On Hold" badge now shows orange

7. CACHE INVALIDATION (Important!)
   After settings change:
   ├── Clear settings cache in settingsLoader
   ├── Refetch dropdown options:
   │   API: GET /api/v1/entity/project/options
   │   → Fresh data with new order and color
   │
   └── All entity tables using project_stage dropdown
       now show updated settings
```

---

## D. Backend Endpoint Interactions

### 1. Universal CRUD Pattern

All entity routes follow the **5 Universal API Patterns** defined in `docs/api/entity_endpoint_design.md`:

#### Pattern 1: UNIFIED DATA GATE

**RBAC + Parent-Child Filtering**

```typescript
// Source: apps/api/src/modules/project/routes.ts:212-385

// LIST endpoint structure
fastify.get('/api/v1/project', async (request, reply) => {
  const { parent_type, parent_id, limit = 50, offset = 0 } = request.query;
  const userId = request.user.sub;

  // GATE 1: RBAC filtering (automatic security)
  const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
    userId,
    'project',      // ENTITY_TYPE constant
    Permission.VIEW,
    'p'            // TABLE_ALIAS constant
  );
  // → WHERE p.id = ANY(SELECT entity_id FROM entity_id_rbac_map
  //                    WHERE person_entity_id = userId AND permission >= 0)

  // GATE 2: Parent-child filtering (optional)
  const parentJoin = parent_type && parent_id
    ? unified_data_gate.parent_child_filtering_gate.getJoinClause(
        'project', parent_type, parent_id, 'p'
      )
    : sql``;
  // → JOIN app.d_entity_id_map map
  //     ON map.child_entity_id = p.id
  //    AND map.parent_entity_type = 'business'
  //    AND map.parent_entity_id = 'xyz789'

  // AUTO-FILTER SYSTEM (Pattern 4)
  const autoFilters = buildAutoFilters('p', request.query, {
    searchFields: ['name', 'descr', 'code']
  });
  // Automatically handles:
  // ?dl__project_stage=active → WHERE p.dl__project_stage = 'active'
  // ?budget_allocated_amt=50000 → WHERE p.budget_allocated_amt = 50000
  // ?start_date=2024-10-01 → WHERE p.start_date = '2024-10-01'
  // ?search=kitchen → WHERE (p.name ILIKE '%kitchen%' OR p.descr ILIKE '%kitchen%')

  // Execute query
  const projects = await db.execute(sql`
    SELECT DISTINCT p.*
    FROM app.d_project p
    ${parentJoin}
    WHERE ${sql.join([rbacCondition, ...autoFilters], sql` AND `)}
    ORDER BY p.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return { data: projects, total, limit, offset };
});
```

#### Pattern 2: CREATE-LINK-EDIT

**Simplified Parent-Child Creation**

```typescript
// Source: apps/api/src/modules/project/routes.ts:500-575

// CREATE endpoint
fastify.post('/api/v1/project', async (request, reply) => {
  const { parent_type, parent_id } = request.query;
  const projectData = request.body;
  const userId = request.user.sub;

  // Step 1: Check CREATE permission (type-level)
  const canCreate = await unified_data_gate.rbac_gate.checkPermission(
    db, userId, 'project', ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) return reply.status(403).send({ error: 'No permission' });

  // Step 2: If parent context, check EDIT permission on parent
  if (parent_type && parent_id) {
    const canEditParent = await unified_data_gate.rbac_gate.checkPermission(
      db, userId, parent_type, parent_id, Permission.EDIT
    );
    if (!canEditParent) return reply.status(403).send({ error: 'Cannot link' });
  }

  // Step 3: Create project
  const newProject = await db.execute(sql`
    INSERT INTO app.d_project (code, name, descr, metadata, ...)
    VALUES (${projectData.code}, ${projectData.name}, ...)
    RETURNING *
  `);

  // Step 4: Link to parent (if context provided)
  if (parent_type && parent_id) {
    await createLinkage(db, {
      parent_entity_type: parent_type,
      parent_entity_id: parent_id,
      child_entity_type: 'project',
      child_entity_id: newProject[0].id,
      relationship_type: 'contains'
    });
  }

  // Step 5: Grant OWNER permission to creator
  await grantPermission(db, {
    personEntityName: 'employee',
    personEntityId: userId,
    entityName: 'project',
    entityId: newProject[0].id,
    permission: Permission.OWNER
  });

  return reply.status(201).send(newProject[0]);
});
```

**Frontend Usage**:

```typescript
// Option 1: Create standalone (no parent)
POST /api/v1/project
Body: { name: "New Project", code: "PROJ-001", ... }
→ Creates project only

// Option 2: Create with parent context (auto-links)
POST /api/v1/project?parent_type=business&parent_id=xyz789
Body: { name: "New Project", code: "PROJ-001", ... }
→ Creates project AND links to business xyz789

// Option 3: Create then link manually (frontend)
1. POST /api/v1/project → { id: "abc123", ... }
2. POST /api/v1/linkage
   Body: {
     parent_entity_type: "business",
     parent_entity_id: "xyz789",
     child_entity_type: "project",
     child_entity_id: "abc123"
   }
→ Same result as Option 2
```

#### Pattern 3: FACTORY-GENERATED ENDPOINTS

**Auto-Generated DELETE and Child Endpoints**

```typescript
// Source: apps/api/src/modules/project/routes.ts:1427-1433

// DELETE endpoint (factory-generated)
createEntityDeleteEndpoint(fastify, 'project');
// Auto-generates:
// DELETE /api/v1/project/:id
// - Soft deletes from d_project (active_flag = false)
// - Cascades to d_entity_instance_id
// - Cascades to d_entity_id_map (both directions)
// - RBAC checks automatically applied

// Child entity endpoints (factory-generated from d_entity metadata)
await createChildEntityEndpointsFromMetadata(fastify, 'project');
// Auto-generates for each child in d_entity.child_entities:
// GET /api/v1/project/:id/task
// GET /api/v1/project/:id/artifact
// GET /api/v1/project/:id/form
// - Applies RBAC filtering
// - Applies parent-child filtering
// - Returns only children linked to this project
```

**How Factory Works**:

```typescript
// Source: apps/api/src/lib/child-entity-route-factory.ts

export async function createChildEntityEndpointsFromMetadata(
  fastify: FastifyInstance,
  parentEntityType: string
) {
  // 1. Fetch child entities from d_entity table
  const metadata = await db.execute(sql`
    SELECT child_entities FROM app.d_entity
    WHERE code = ${parentEntityType} AND active_flag = true
  `);

  const childTypes = metadata[0]?.child_entities || [];

  // 2. For each child type, create endpoint
  for (const childType of childTypes) {
    fastify.get(`/api/v1/${parentEntityType}/:id/${childType}`, {
      preHandler: [fastify.authenticate],
      schema: { /* ... */ }
    }, async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.sub;

      // RBAC check
      const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
        userId, childType, Permission.VIEW, 'c'
      );

      // Parent-child join
      const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(
        childType, parentEntityType, id, 'c'
      );

      // Query
      const children = await db.execute(sql`
        SELECT DISTINCT c.*
        FROM app.d_${sql.raw(childType)} c
        ${parentJoin}
        WHERE ${rbacCondition}
          AND c.active_flag = true
      `);

      return { data: children };
    });
  }
}
```

#### Pattern 4: UNIVERSAL AUTO-FILTER SYSTEM

**Zero-Config Query Filtering**

```typescript
// Source: apps/api/src/lib/universal-filter-builder.ts

export function buildAutoFilters(
  tableAlias: string,
  queryParams: Record<string, any>,
  options?: { overrides?: Record<string, FilterDef>, searchFields?: string[] }
): SQL[] {
  const filters: SQL[] = [];

  for (const [key, value] of Object.entries(queryParams)) {
    // Skip pagination params
    if (['limit', 'offset', 'page', 'parent_type', 'parent_id'].includes(key)) {
      continue;
    }

    // AUTO-DETECTION PATTERNS:

    // 1. Settings dropdown (dl__*)
    if (key.startsWith('dl__')) {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value}`);
    }

    // 2. Entity reference (*_id with UUID format)
    else if (key.endsWith('_id') && isUUID(value)) {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value}::uuid`);
    }

    // 3. Currency (*_amt)
    else if (key.endsWith('_amt') && typeof value === 'number') {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value}`);
    }

    // 4. Date (*_date, *_ts)
    else if ((key.endsWith('_date') || key.endsWith('_ts')) && typeof value === 'string') {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value}::date`);
    }

    // 5. Boolean (is_*, *_flag)
    else if ((key.startsWith('is_') || key.endsWith('_flag')) && typeof value === 'boolean') {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value}`);
    }

    // 6. Search (special multi-field search)
    else if (key === 'search' && options?.searchFields) {
      const searchConditions = options.searchFields.map(field =>
        sql`${sql.raw(tableAlias)}.${sql.raw(field)} ILIKE ${'%' + value + '%'}`
      );
      filters.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
    }

    // 7. Default: exact match
    else {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value}`);
    }
  }

  return filters;
}
```

**Usage in Routes**:

```typescript
// Instead of manual filter building:
const filters = [];
if (query.dl__project_stage) filters.push(sql`p.dl__project_stage = ${query.dl__project_stage}`);
if (query.budget_allocated_amt) filters.push(sql`p.budget_allocated_amt = ${query.budget_allocated_amt}`);
if (query.start_date) filters.push(sql`p.start_date = ${query.start_date}`);
if (query.search) filters.push(sql`(p.name ILIKE ${'%' + query.search + '%'} OR ...)`);

// Just one line with auto-filters:
const filters = buildAutoFilters('p', query, { searchFields: ['name', 'descr', 'code'] });
```

#### Pattern 5: MODULE-LEVEL CONSTANTS (DRY)

**Single Source of Truth**

```typescript
// Source: apps/api/src/modules/project/routes.ts:205-208

// ✅ GOOD: Define once, use everywhere
const ENTITY_TYPE = 'project';
const TABLE_ALIAS = 'p';

// Used in all endpoints
fastify.get('/api/v1/project', async () => {
  const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
    userId, ENTITY_TYPE, Permission.VIEW, TABLE_ALIAS
  );
  const query = sql`SELECT ${sql.raw(TABLE_ALIAS)}.* FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}`;
});

fastify.post('/api/v1/project', async () => {
  const canCreate = await unified_data_gate.rbac_gate.checkPermission(
    db, userId, ENTITY_TYPE, ALL_ENTITIES_ID, Permission.CREATE
  );
});

fastify.patch('/api/v1/project/:id', async () => {
  const canEdit = await unified_data_gate.rbac_gate.checkPermission(
    db, userId, ENTITY_TYPE, id, Permission.EDIT
  );
});

createEntityDeleteEndpoint(fastify, ENTITY_TYPE);
await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);

// ❌ BAD: Hardcoding strings everywhere (prone to typos)
fastify.get('/api/v1/project', async () => {
  // ... uses 'project' here
});
fastify.post('/api/v1/project', async () => {
  // ... uses 'prject' here (typo!)
});
```

---

### 2. Component-Specific Endpoints

#### EntityDataTable Endpoints

```typescript
// LIST with pagination and filtering
GET /api/v1/{entity}?limit=50&offset=0&search=keyword&dl__*=value&active=true

// GET single
GET /api/v1/{entity}/{id}

// UPDATE (inline edit)
PATCH /api/v1/{entity}/{id}
Body: { [field]: newValue }

// DELETE
DELETE /api/v1/{entity}/{id}
```

**Query Parameter Patterns**:

| Parameter | Type | Example | Backend Filter |
|-----------|------|---------|---------------|
| `limit` | Number | `?limit=50` | `LIMIT 50` |
| `offset` | Number | `?offset=100` | `OFFSET 100` |
| `page` | Number | `?page=3` | `OFFSET (3-1)*50` |
| `search` | String | `?search=kitchen` | `WHERE name ILIKE '%kitchen%' OR descr ILIKE '%kitchen%'` |
| `dl__*` | String | `?dl__project_stage=active` | `WHERE dl__project_stage = 'active'` |
| `*_id` | UUID | `?business_id=xyz789` | `WHERE business_id = 'xyz789'::uuid` |
| `*_amt` | Number | `?budget_allocated_amt=50000` | `WHERE budget_allocated_amt = 50000` |
| `*_date` | Date | `?start_date=2024-10-01` | `WHERE start_date = '2024-10-01'` |
| `is_*`, `*_flag` | Boolean | `?active=true` | `WHERE active_flag = true` |
| `parent_type` + `parent_id` | String + UUID | `?parent_type=business&parent_id=xyz` | `JOIN d_entity_id_map ...` |

#### KanbanBoard Endpoints

```typescript
// GET kanban data (grouped by status)
GET /api/v1/{parent}/{parentId}/{child}/kanban
Example: GET /api/v1/project/abc123/tasks/kanban
Response: {
  project: { id: "abc123", name: "Website Redesign" },
  columns: {
    backlog: [...tasks],
    in_progress: [...tasks],
    done: [...tasks]
  },
  stats: { total: 45, by_status: {...} }
}

// UPDATE status (drag-drop)
PATCH /api/v1/{entity}/{id}/status
Body: {
  task_status: "done",
  position: 2,
  moved_by: "user-id"
}

// KANBAN-SPECIFIC: Update with metadata
UPDATE app.d_task
SET dl__task_stage = 'done',
    metadata = metadata || jsonb_build_object(
      'kanban_moved_at', NOW()::text,
      'kanban_moved_by', userId,
      'kanban_position', 2
    )
WHERE id = {taskId}
```

#### SettingsDataTable Endpoints

```typescript
// LIST settings (always ordered)
GET /api/v1/datalabel/{type}?limit=100
Example: GET /api/v1/datalabel/project_stage
Response: {
  data: [
    { id: 1, code: 'planning', name: 'Planning', color_code: '#gray', display_order: 1 },
    { id: 2, code: 'active', name: 'Active', color_code: '#blue', display_order: 2 }
  ],
  total: 4
}

// REORDER (batch update)
PATCH /api/v1/datalabel/{type}/reorder
Body: {
  items: [
    { id: 3, display_order: 1 },
    { id: 1, display_order: 2 },
    { id: 2, display_order: 3 }
  ]
}

// UPDATE single setting
PATCH /api/v1/datalabel/{type}/{id}
Body: { color_code: '#orange' }
```

#### DynamicChildEntityTabs Endpoints

```typescript
// GET child entity metadata
GET /api/v1/{parent}/{id}/dynamic-child-entity-tabs
Example: GET /api/v1/business/xyz789/dynamic-child-entity-tabs
Response: {
  tabs: [
    { entity_type: 'project', count: 12 },
    { entity_type: 'employee', count: 45 },
    { entity_type: 'client', count: 8 }
  ]
}

// GET creatable entities (permission-filtered)
GET /api/v1/{parent}/{id}/creatable
Example: GET /api/v1/business/xyz789/creatable
Response: {
  creatable: ['project', 'employee']  // User can CREATE these types
}

// FILTER child entities by parent
GET /api/v1/{child}?parent_type={parent}&parent_id={id}&limit=50
Example: GET /api/v1/project?parent_type=business&parent_id=xyz789
→ Returns only projects linked to business xyz789
```

#### DAGVisualizer Endpoints

```typescript
// GET workflow stage options (for Mermaid generation)
GET /api/v1/entity/{type}/options
Example: GET /api/v1/entity/task/options
Response: {
  dl__task_stage: [
    { code: 'backlog', name: 'Backlog', color_code: '#gray', display_order: 1 },
    { code: 'in_progress', name: 'In Progress', color_code: '#blue', display_order: 2 },
    { code: 'done', name: 'Done', color_code: '#green', display_order: 3 }
  ]
}

// Frontend generates Mermaid DAG from response
graph TD
  backlog["Backlog"] --> in_progress["In Progress"]
  in_progress --> done["Done"]
```

---

### 3. Centralized Services & Libraries

All components use these shared backend services:

#### Unified Data Gate (`lib/unified-data-gate.ts`)

**Purpose**: Centralized RBAC + parent-child filtering

```typescript
// RBAC Gate - Permission checking
unified_data_gate.rbac_gate.checkPermission(
  db, userId, entityType, entityId, permission
)
→ Returns boolean

unified_data_gate.rbac_gate.getWhereCondition(
  userId, entityType, permission, tableAlias
)
→ Returns SQL condition for filtering

// Parent-Child Gate - Context filtering
unified_data_gate.parent_child_filtering_gate.getJoinClause(
  childType, parentType, parentId, tableAlias
)
→ Returns SQL JOIN for parent-child relationships
```

**Used by all components** to enforce security and context.

#### Linkage Service (`services/linkage.service.js`)

**Purpose**: Idempotent parent-child relationship management

```typescript
await createLinkage(db, {
  parent_entity_type: 'business',
  parent_entity_id: 'xyz789',
  child_entity_type: 'project',
  child_entity_id: 'abc123',
  relationship_type: 'contains'
});

// Idempotent:
// - If linkage exists and active → no-op
// - If linkage exists but inactive → reactivates
// - If no linkage → creates new
```

**Used by**: EntityFormPage (create), EntityDataTable (inline create)

#### Universal Filter Builder (`lib/universal-filter-builder.ts`)

**Purpose**: Zero-config query filtering from URL params

```typescript
const filters = buildAutoFilters(tableAlias, request.query, {
  searchFields: ['name', 'descr', 'code']
});
→ Returns SQL[] array of filter conditions
```

**Used by all LIST endpoints** (EntityDataTable, SettingsDataTable, KanbanBoard)

#### Universal Schema Metadata (`lib/universal-schema-metadata.ts`)

**Purpose**: Database introspection and column detection

```typescript
const columns = await getUniversalColumnMetadata('project');
→ Returns column definitions from database schema

const filtered = filterUniversalColumns(data, userPermissions);
→ Filters sensitive columns based on user permissions
```

**Used by**: API routes to auto-detect available columns

---

### 4. RBAC Permission Model

**Person-Based Permissions** (from `docs/api/entity_endpoint_design.md`):

```sql
-- Permission hierarchy (automatic inheritance)
Permission.OWNER  = 5  -- Full control (implies all below)
Permission.CREATE = 4  -- Create new entities (type-level only)
Permission.DELETE = 3  -- Soft delete (implies Share/Edit/View)
Permission.SHARE  = 2  -- Share with others (implies Edit/View)
Permission.EDIT   = 1  -- Modify entity (implies View)
Permission.VIEW   = 0  -- Read-only access

-- Type-level permissions (applies to all entities of type)
ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111'

-- Permission checks
SELECT 1 FROM app.entity_id_rbac_map
WHERE person_entity_name = 'employee'
  AND person_entity_id = {userId}
  AND entity_name = 'project'
  AND (entity_id = {projectId} OR entity_id = '11111111-1111-1111-1111-111111111111')
  AND permission >= {required_permission}
  AND active_flag = true
  AND (expires_ts IS NULL OR expires_ts > NOW())
```

**Permission Flow**:

```
1. User requests action
   ↓
2. Component checks permission
   - EntityDataTable → inline edit requires EDIT
   - KanbanBoard → drag-drop requires EDIT
   - DynamicChildEntityTabs → create button requires CREATE
   ↓
3. API endpoint validates
   - unified_data_gate.rbac_gate.checkPermission()
   - Returns 403 if insufficient permission
   ↓
4. Database executes query
   - Only on data user can access
   - Pre-filtered by RBAC WHERE condition
```

---

### 5. Database Schema (DDL Source of Truth)

All components render data from these standard DDL patterns:

#### Standard Entity Table Structure

```sql
-- Source: db/d_project.ddl (representative example)
CREATE TABLE IF NOT EXISTS app.d_project (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields (all entities have these)
  code varchar(100) NOT NULL UNIQUE,
  name varchar(500) NOT NULL,
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Business-specific fields (vary by entity)
  dl__project_stage varchar(50),           -- Settings dropdown
  dl__project_priority varchar(50),        -- Settings dropdown
  budget_allocated_amt decimal(15,2),      -- Currency
  budget_spent_amt decimal(15,2),          -- Currency
  start_date date,                         -- Date
  end_date date,                           -- Date
  completion_pct integer,                  -- Percentage

  -- Temporal fields (all entities have these)
  from_ts timestamp with time zone DEFAULT now() NOT NULL,
  to_ts timestamp with time zone,
  active_flag boolean DEFAULT true NOT NULL,
  created_ts timestamp with time zone DEFAULT now() NOT NULL,
  updated_ts timestamp with time zone DEFAULT now() NOT NULL,
  version integer DEFAULT 1 NOT NULL
);
```

**Field Naming Conventions** (auto-detected by universalFieldDetector):

| Pattern | Example | Component | Render Function |
|---------|---------|-----------|-----------------|
| `dl__*` | `dl__project_stage` | Settings dropdown | `<Badge color={getColor(value)}>` |
| `*_amt` | `budget_allocated_amt` | Currency input | `formatCurrency(value)` |
| `*_date` | `start_date` | Date picker | `formatDate(value)` |
| `*_ts` | `created_ts` | Timestamp display | `formatRelativeTime(value)` → "3 days ago" |
| `*_pct` | `completion_pct` | Number input | `${value}%` |
| `is_*`, `*_flag` | `active_flag` | Toggle | `<Toggle checked={value} />` |
| `*_id` | `business_id` | Hidden field + name lookup | `<span>{business_name}</span>` |
| `tags` | `tags` | Tag input | `<TagList tags={value} />` |
| `metadata`, `*_json` | `metadata` | JSON editor | `<JSONEditor value={value} />` |

#### Settings Table Structure

```sql
-- Source: db/03_setting_datalabel.ddl
CREATE TABLE IF NOT EXISTS app.setting_datalabel_project_stage (
  id serial PRIMARY KEY,
  code varchar(50) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  descr text,
  color_code varchar(7),               -- Hex color for badges
  display_order integer NOT NULL,      -- For drag-drop ordering
  active_flag boolean DEFAULT true NOT NULL,
  created_ts timestamp with time zone DEFAULT now() NOT NULL,
  updated_ts timestamp with time zone DEFAULT now() NOT NULL
);
```

**Used by**: SettingsDataTable, all dropdown filters, KanbanBoard columns

#### Linkage Table (Parent-Child Relationships)

```sql
-- Source: db/02_d_entity_id_map.ddl
CREATE TABLE IF NOT EXISTS app.d_entity_id_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_entity_type varchar(50) NOT NULL,
  parent_entity_id uuid NOT NULL,
  child_entity_type varchar(50) NOT NULL,
  child_entity_id uuid NOT NULL,
  relationship_type varchar(50) DEFAULT 'contains',
  active_flag boolean DEFAULT true NOT NULL,
  created_ts timestamp with time zone DEFAULT now() NOT NULL,

  UNIQUE (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
);
```

**Used by**: DynamicChildEntityTabs, parent-filtered EntityDataTable, createLinkage service

---

### 6. API Response Formats

#### Standard List Response

```json
{
  "data": [
    {
      "id": "abc123",
      "code": "PROJ-001",
      "name": "Website Redesign",
      "descr": "Modernize company website",
      "dl__project_stage": "active",
      "budget_allocated_amt": 50000.00,
      "start_date": "2024-10-01",
      "completion_pct": 45,
      "business_id": "xyz789",          // Foreign key (hidden in UI)
      "business_name": "Operations",    // Lookup value (visible in UI)
      "created_ts": "2024-10-01T10:00:00Z",
      "active_flag": true
    }
  ],
  "total": 145,
  "limit": 50,
  "offset": 0
}
```

#### Entity Options Response (Dropdowns)

```json
{
  "dl__project_stage": [
    { "code": "planning", "name": "Planning", "color_code": "#6b7280", "display_order": 1 },
    { "code": "active", "name": "Active", "color_code": "#3b82f6", "display_order": 2 },
    { "code": "on_hold", "name": "On Hold", "color_code": "#f59e0b", "display_order": 3 },
    { "code": "completed", "name": "Completed", "color_code": "#10b981", "display_order": 4 }
  ],
  "dl__project_priority": [
    { "code": "low", "name": "Low", "color_code": "#6b7280", "display_order": 1 },
    { "code": "medium", "name": "Medium", "color_code": "#f59e0b", "display_order": 2 },
    { "code": "high", "name": "High", "color_code": "#ef4444", "display_order": 3 }
  ]
}
```

#### Kanban Response

```json
{
  "project": {
    "id": "abc123",
    "name": "Website Redesign"
  },
  "columns": {
    "backlog": [
      { "id": "task1", "name": "Design mockups", "dl__task_stage": "backlog", ... }
    ],
    "in_progress": [
      { "id": "task2", "name": "Implement header", "dl__task_stage": "in_progress", ... }
    ],
    "done": [
      { "id": "task3", "name": "Setup repository", "dl__task_stage": "done", ... }
    ]
  },
  "stats": {
    "total": 12,
    "by_status": {
      "backlog": 5,
      "in_progress": 4,
      "done": 3
    }
  }
}
```

---

## Summary: Component → Backend Mapping

| Component | Primary Endpoints | Key Backend Patterns |
|-----------|------------------|---------------------|
| **EntityDataTable** | `GET /api/v1/{entity}`<br>`PATCH /api/v1/{entity}/{id}`<br>`DELETE /api/v1/{entity}/{id}` | • RBAC filtering<br>• Auto-filters<br>• Universal column detection<br>• Inline edit validation |
| **SettingsDataTable** | `GET /api/v1/datalabel/{type}`<br>`PATCH /api/v1/datalabel/{type}/reorder`<br>`PATCH /api/v1/datalabel/{type}/{id}` | • Ordered by `display_order`<br>• Batch reorder transactions<br>• Color code management |
| **KanbanBoard** | `GET /api/v1/{parent}/{id}/{child}/kanban`<br>`PATCH /api/v1/{entity}/{id}/status` | • Status grouping<br>• Position metadata<br>• Optimistic updates |
| **DAGVisualizer** | `GET /api/v1/entity/{type}/options` | • Stage sequence<br>• Color mapping<br>• Mermaid syntax generation |
| **DynamicChildEntityTabs** | `GET /api/v1/{parent}/{id}/dynamic-child-entity-tabs`<br>`GET /api/v1/{child}?parent_type=X&parent_id=Y` | • Metadata-driven tabs<br>• Parent-child JOIN<br>• Child count aggregation |

---

**End of UI Components Architecture Documentation**
