# Project & Task Entities - Complete Technical Documentation

> **Core PMO Entities** - Projects as strategic containers and Tasks as actionable work items

---

## 📋 Table of Contents

1. [Semantics & Business Context](#semantics--business-context)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [Database, API & UI/UX Mapping](#database-api--uiux-mapping)
4. [DRY Principles & Entity Relationships](#dry-principles--entity-relationships)
5. [Central Configuration & Middleware](#central-configuration--middleware)
6. [User Interaction Flow Examples](#user-interaction-flow-examples)
7. [Critical Considerations When Editing](#critical-considerations-when-editing)

---

## Semantics & Business Context

### Business Purpose

**Projects** serve as the primary organizational container for strategic initiatives in the PMO platform. They represent:
- Strategic initiatives with defined budgets, timelines, and stakeholders
- Business unit deliverables tracked through lifecycle stages
- Parent containers for tasks, artifacts, wiki pages, and forms
- Financial tracking units with budget allocation and spending

**Tasks** are the atomic work units that comprise projects. They provide:
- Actionable work items with assignments and time tracking
- Kanban workflow management through configurable stages
- Priority-based work queue management
- Public sharing capability via presigned URLs for external stakeholders

### Business Workflows

#### Project Lifecycle
```
Initiation → Planning → Execution → Monitoring → Closure
     ↓          ↓           ↓            ↓          ↓
  Ideation  Resourcing  Active Work  Oversight  Closeout
```

#### Task Workflow
```
Backlog → To Do → In Progress → In Review → Done
   ↓        ↓          ↓            ↓         ↓
Planned  Queued    Active      Validation  Complete
```

### Key Business Rules

**Projects:**
- Budget tracking: `budget_allocated` vs `budget_spent` with financial variance analysis
- Timeline management: `planned_*` vs `actual_*` dates for schedule adherence
- Team hierarchy: Manager → Sponsor → Stakeholders (stored as UUID arrays)
- Stage transitions reflect project health and are reported to executives
- Linked to business units and offices for organizational hierarchy

**Tasks:**
- Time estimation: `estimated_hours` vs `actual_hours` for burn-down tracking
- Priority-based sorting: `critical` → `high` → `medium` → `low`
- Multi-assignee support via `entity_id_map` linkage table
- Shared URLs for external collaboration without authentication

---

## Architecture & Design Patterns

### Universal Entity System

Both Project and Task leverage the **Universal Entity Pattern** which provides:

1. **Consistent Data Model** - All entities share common SCD fields:
   ```typescript
   {
     id: UUID,              // Stable identifier (never changes)
     version: INTEGER,      // Audit trail (increments on update)
     from_ts: TIMESTAMP,    // Record birth (immutable)
     to_ts: TIMESTAMP,      // Soft delete time (null = active)
     active_flag: BOOLEAN,  // Query optimization flag
     created_ts: TIMESTAMP, // Creation time (immutable)
     updated_ts: TIMESTAMP  // Last modification (refreshed on update)
   }
   ```

2. **Universal API Pattern** - Standardized endpoints:
   ```
   GET    /api/v1/{entity}           → List all (RBAC filtered)
   GET    /api/v1/{entity}/{id}      → Get single entity
   POST   /api/v1/{entity}           → Create new entity
   PUT    /api/v1/{entity}/{id}      → Update entity (in-place)
   DELETE /api/v1/{entity}/{id}      → Soft delete (active_flag=false)
   GET    /api/v1/{parent}/{id}/{child} → List children (filtered)
   ```

3. **Universal UI Components** - Reusable pages and components:
   - `EntityMainPage` - List view with table/kanban/grid modes
   - `EntityDetailPage` - Detail view with dynamic child tabs
   - `EntityChildListPage` - Child entity list within parent context
   - `FilteredDataTable` - Data table with inline editing and pagination
   - `KanbanView` - Settings-driven Kanban view for any entity
   - `useKanbanColumns` - Hook for loading Kanban columns from settings
   - `DynamicChildEntityTabs` - Auto-generated tabs from API metadata

### Design Patterns

#### 1. **Centralized Entity Configuration**
```typescript
// apps/web/src/lib/entityConfig.ts
export const entityConfigs: Record<string, EntityConfig> = {
  project: {
    name: 'project',
    columns: [...],    // Table view columns with inline editing
    fields: [...],     // Form/detail fields with validation
    supportedViews: ['table'],
    defaultView: 'table'
  },
  task: {
    name: 'task',
    columns: [...],
    fields: [...],
    supportedViews: ['table', 'kanban'],
    defaultView: 'table',
    kanban: {
      groupByField: 'stage',
      cardFields: ['name', 'priority_level', 'estimated_hours']
    }
  }
}
```

**Pattern Benefits:**
- Single source of truth for entity behavior
- DRY principle: change once, updates everywhere
- Type-safe configuration with TypeScript
- Supports dynamic loading of settings-driven dropdowns

#### 2. **Settings-Driven Dropdowns & Kanban Columns**

**Table View Dropdowns:**
```typescript
// Columns/fields marked with loadOptionsFromSettings: true
{
  key: 'project_stage',
  loadOptionsFromSettings: true  // → GET /api/v1/setting?category=project_stage
}
```

**Kanban View Columns:**
```typescript
// Kanban configuration specifies settings table
{
  kanban: {
    groupByField: 'stage',
    metaTable: 'setting_datalabel_task_stage',  // → category: 'task_stage'
    cardFields: ['name', 'priority_level']
  }
}
```

**Settings Table Mapping:**
```
project_stage     → setting_datalabel_project_stage
task_stage        → setting_datalabel_task_stage
task_priority     → setting_datalabel_task_priority
```

**Benefits:**
- ✅ Single source of truth for both dropdowns AND Kanban columns
- ✅ Business users can configure via settings UI
- ✅ Changes propagate to all views immediately
- ✅ Consistent data across table, form, and Kanban views

#### 3. **Relationship Mapping Without Foreign Keys**
```sql
-- entity_id_map stores parent-child relationships
SELECT t.* FROM d_task t
INNER JOIN entity_id_map eim
  ON eim.child_entity_id = t.id::text
WHERE eim.parent_entity_id = $project_id
  AND eim.parent_entity_type = 'project'
  AND eim.child_entity_type = 'task'
  AND eim.active_flag = true
```

**Why No Foreign Keys?**
- Flexibility for cross-schema relationships
- Soft deletes don't cascade to children
- Supports temporal relationships with from_ts/to_ts
- Enables multi-parent scenarios (task linked to project + client)

#### 4. **In-Place Updates (SCD Type 1)**
```sql
-- Same ID preserved across updates
UPDATE d_project
SET project_stage = $1,
    version = version + 1,
    updated_ts = now()
WHERE id = $2
```

**Benefits:**
- Child relationships remain intact (stable parent ID)
- Version field provides audit trail
- No archive tables to manage
- Optimized for real-time workflow updates

---

## Database, API & UI/UX Mapping

### Database Schema

#### Projects Table: `d_project`

**Location:** `db/18_d_project.ddl`

```sql
CREATE TABLE app.d_project (
    -- Identity
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Project-specific fields
    project_stage text,               -- Workflow state
    budget_allocated decimal(15,2),   -- Financial planning
    budget_spent decimal(15,2) DEFAULT 0,
    planned_start_date date,
    planned_end_date date,
    actual_start_date date,
    actual_end_date date,

    -- Team assignments
    manager_employee_id uuid,
    sponsor_employee_id uuid,
    stakeholder_employee_ids uuid[] DEFAULT '{}',

    -- SCD fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);
```

**Key Indexes:**
```sql
CREATE INDEX idx_project_active ON d_project(active_flag) WHERE active_flag = true;
CREATE INDEX idx_project_stage ON d_project(project_stage);
CREATE INDEX idx_project_dates ON d_project(planned_start_date, planned_end_date);
```

#### Tasks Table: `d_task`

**Location:** `db/19_d_task.ddl`

```sql
CREATE TABLE app.d_task (
    -- Identity
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    internal_url varchar(500),  -- /task/{id} (authenticated)
    shared_url varchar(500),    -- /task/{8-char} (public presigned)
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Task-specific fields
    stage text,                    -- Kanban column state
    priority_level varchar(20) DEFAULT 'medium',
    estimated_hours decimal(8,2),
    actual_hours decimal(8,2) DEFAULT 0,
    story_points integer,

    -- SCD fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- NOTE: Task assignees managed via entity_id_map
-- Query assignees:
--   SELECT e.* FROM d_employee e
--   INNER JOIN entity_id_map eim ON eim.child_entity_id = e.id::text
--   WHERE eim.parent_entity_id = '<task-uuid>'
--     AND eim.parent_entity_type = 'task'
--     AND eim.child_entity_type = 'employee'
--     AND eim.relationship_type = 'assigned_to'
```

**Key Indexes:**
```sql
CREATE INDEX idx_task_active ON d_task(active_flag) WHERE active_flag = true;
CREATE INDEX idx_task_stage ON d_task(stage);
CREATE INDEX idx_task_priority ON d_task(priority_level);
CREATE INDEX idx_task_shared ON d_task(shared_url) WHERE shared_url IS NOT NULL;
```

### API Endpoints

**Location:** `apps/api/src/modules/entity/universal-parent-action-routes.ts`

#### Project API Endpoints

```typescript
// List all projects (RBAC filtered)
GET /api/v1/project
Query: ?page=1&limit=50&project_stage=Execution&sortBy=created_ts&sortOrder=desc
Response: {
  data: [...],
  total: 150,
  page: 1,
  limit: 50
}

// Get single project
GET /api/v1/project/{id}
Response: {
  id: "uuid",
  name: "Digital Transformation Initiative",
  project_stage: "In Progress",
  budget_allocated: 750000.00,
  budget_spent: 285000.00,
  ...
}

// Create project
POST /api/v1/project
Body: {
  name: "New Strategic Initiative",
  code: "NSI-2024-001",
  slug: "new-strategic-initiative",
  project_stage: "Initiation",
  budget_allocated: 500000.00,
  planned_start_date: "2024-11-01"
}

// Update project (in-place)
PUT /api/v1/project/{id}
Body: {
  project_stage: "Execution",
  actual_start_date: "2024-11-15"
}

// Soft delete project
DELETE /api/v1/project/{id}

// List project's tasks (filtered children)
GET /api/v1/project/{id}/task
Query: ?stage=In Progress&priority_level=high
Response: {
  data: [...],
  total: 8,
  parent_info: {
    entity_type: "project",
    entity_id: "uuid",
    entity_name: "Digital Transformation Initiative"
  }
}

// Get project child entity counts (for tabs)
GET /api/v1/entity/child-tabs/project/{id}
Response: {
  action_entities: [
    { actionEntity: "task", count: 8, label: "Tasks", icon: "CheckSquare" },
    { actionEntity: "wiki", count: 3, label: "Wiki", icon: "BookOpen" },
    { actionEntity: "artifact", count: 5, label: "Artifacts", icon: "FileText" }
  ]
}
```

#### Task API Endpoints

```typescript
// List all tasks (RBAC filtered)
GET /api/v1/task
Query: ?stage=In Progress&assignee=uuid

// Get single task
GET /api/v1/task/{id}

// Get task via shared URL (NO AUTH REQUIRED)
GET /task/{8-char-code}
Example: GET /task/xT4pQ2nR
Response: Public-facing task view with limited fields

// Create task (assignees managed separately)
POST /api/v1/task
Body: {
  name: "Implement user authentication",
  code: "DT-TASK-015",
  slug: "implement-user-auth",
  stage: "Backlog",
  priority_level: "high",
  estimated_hours: 40.0
}
// Response: { id: "new-task-uuid", ... }

// Add assignees via linkage API (separate step)
POST /api/v1/linkage
Body: {
  parent_entity_type: "task",
  parent_entity_id: "new-task-uuid",
  child_entity_type: "employee",
  child_entity_id: "employee-uuid",
  relationship_type: "assigned_to"
}
// Repeat for each assignee

// Update task (stage change, inline edit)
PUT /api/v1/task/{id}
Body: {
  stage: "In Progress",
  actual_hours: 12.5
}
// NOTE: Assignee updates must use linkage API separately

// Soft delete task
DELETE /api/v1/task/{id}

// Get task assignees
GET /api/v1/task/{id}/assignees
Response: {
  success: true,
  data: [{ id, name, email, linkage_id }, ...]
}
```

### UI/UX Components

#### Page Hierarchy

```
App.tsx (Router)
  ├─ /project → EntityMainPage (entityType="project")
  │   └─ Renders: FilteredDataTable with project columns
  │
  ├─ /project/:id → EntityDetailPage (entityType="project")
  │   ├─ Overview Tab: Entity fields in Notion-style layout
  │   ├─ Tasks Tab: Nested route → EntityChildListPage
  │   ├─ Wiki Tab: Nested route → EntityChildListPage
  │   └─ Artifacts Tab: Nested route → EntityChildListPage
  │
  ├─ /project/:id/task → EntityChildListPage (parent="project", child="task")
  │   └─ Renders: FilteredDataTable filtered by project_id
  │
  ├─ /task → EntityMainPage (entityType="task")
  │   └─ Renders: FilteredDataTable OR KanbanBoard (view switcher)
  │
  └─ /task/:id → EntityDetailPage (entityType="task")
      ├─ Overview Tab: Task fields
      ├─ Share URL Section: Public sharing for external stakeholders
      └─ Task Updates: Historical comments and status changes
```

#### Component Architecture

**EntityMainPage** (`apps/web/src/pages/shared/EntityMainPage.tsx`)
```typescript
// Universal list page for all entities
function EntityMainPage({ entityType }) {
  const config = getEntityConfig(entityType); // Get entity configuration
  const [view, setView] = useState(config.defaultView);

  return (
    <Layout>
      {/* View switcher: table/kanban/grid */}
      <ViewSwitcher view={view} onChange={setView} />

      {view === 'table' && (
        <FilteredDataTable
          entityType={entityType}
          columns={config.columns}
          onRowClick={(item) => navigate(`/${entityType}/${item.id}`)}
        />
      )}

      {view === 'kanban' && config.kanban && (
        <KanbanView
          config={config}
          data={data}
          onCardClick={handleRowClick}
          onCardMove={handleCardMove}
        />
      )}
    </Layout>
  );
}
```

**EntityDetailPage** (`apps/web/src/pages/shared/EntityDetailPage.tsx`)
```typescript
// Universal detail page with dynamic child entity tabs
function EntityDetailPage({ entityType }) {
  const { id } = useParams();
  const config = getEntityConfig(entityType);

  // Fetch entity data
  const { data } = useEntity(entityType, id);

  // Fetch dynamic child tabs from API
  const { tabs } = useDynamicChildEntityTabs(entityType, id);

  return (
    <Layout>
      {/* Dynamic tabs: Overview + child entity tabs */}
      <DynamicChildEntityTabs tabs={tabs} />

      {/* Overview tab content */}
      {isOverviewTab && (
        <EntityFormContainer
          config={config}
          data={data}
          isEditing={isEditing}
        />
      )}

      {/* Nested child routes render here */}
      <Outlet />
    </Layout>
  );
}
```

**EntityChildListPage** (`apps/web/src/pages/shared/EntityChildListPage.tsx`)
```typescript
// Renders filtered child entities within parent context
function EntityChildListPage({ parentType, childType }) {
  const { id: parentId } = useParams();
  const config = getEntityConfig(childType);

  return (
    <>
      {view === 'table' && (
        <FilteredDataTable
          entityType={childType}
          parentType={parentType}
          parentId={parentId}
        />
      )}

      {view === 'kanban' && config.kanban && (
        <KanbanView
          config={config}
          data={data}
          onCardClick={handleRowClick}
          onCardMove={handleCardMove}
        />
      )}
    </>
  );
}
```

#### Inline Editing

**Columns with `inlineEditable: true` support direct editing:**

```typescript
// entityConfig.ts:197-202
{
  key: 'project_stage',
  title: 'Stage',
  inlineEditable: true,
  loadOptionsFromSettings: true,  // Dropdown from API
  render: (value) => renderBadge(value, colorMap)
}

// User clicks badge → Dropdown appears
// User selects "Execution" → PUT /api/v1/project/{id} { project_stage: "Execution" }
// Table refreshes → Badge updates to new stage
```

**Settings-Driven Dropdowns:**

```typescript
// 1. Frontend requests settings
GET /api/v1/setting?category=project_stage

// 2. API returns options from setting_datalabel_project_stage
Response: {
  category: "project_stage",
  options: [
    { value: "Initiation", label: "Initiation", order: 1 },
    { value: "Planning", label: "Planning", order: 2 },
    { value: "Execution", label: "Execution", order: 3 },
    { value: "Monitoring", label: "Monitoring", order: 4 },
    { value: "Closure", label: "Closure", order: 5 }
  ]
}

// 3. Frontend renders dropdown in inline editor
// 4. User selection triggers PUT request with new value
```

---

## DRY Principles & Entity Relationships

### Reusable Component Patterns

#### 1. **Entity Configuration as Single Source of Truth**

**Instead of:**
```typescript
// ❌ BAD: Hardcoding columns in every page
function ProjectList() {
  const columns = [
    { key: 'name', title: 'Project Name' },
    { key: 'project_stage', title: 'Stage' },
    // ... repeated 10+ times across different files
  ];
}
```

**We use:**
```typescript
// ✅ GOOD: Centralized configuration
const config = getEntityConfig('project');
<FilteredDataTable columns={config.columns} />
```

#### 4. **Settings-Driven Kanban Columns**

Kanban views load ALL columns from the settings API, ensuring consistency across all views:

```typescript
// Universal Kanban hook - loads from settings API
const { columns, loading, error } = useKanbanColumns(config, data);

// KanbanView component - settings-driven, no hardcoded stages
<KanbanView
  config={config}
  data={data}
  onCardClick={handleRowClick}
  onCardMove={handleCardMove}
/>
```

**How it works:**
1. Hook extracts settings category from `config.kanban.metaTable`
2. Fetches stages from `/api/v1/setting?category=task_stage`
3. Creates columns for ALL configured stages (even empty ones)
4. Groups data items by `config.kanban.groupByField`
5. Respects `sort_order` from settings table

**Benefits:**
- ✅ All Kanban views show identical columns
- ✅ Business users can configure stages via settings
- ✅ No hardcoded fallbacks - errors display clearly
- ✅ Single implementation for all entities

#### 2. **Universal API Factory**

**Location:** `apps/web/src/lib/api.ts`

```typescript
// Single factory creates type-safe APIs for all entities
const projectApi = APIFactory.getAPI('project');
const taskApi = APIFactory.getAPI('task');

// All have consistent methods
projectApi.list({ page: 1, limit: 50 });
projectApi.get(id);
projectApi.create(data);
projectApi.update(id, data);
projectApi.delete(id);

// Parent-child queries
projectApi.getTasks(projectId);  // GET /api/v1/project/{id}/task
```

#### 3. **Shared Utility Functions**

```typescript
// apps/web/src/lib/entityConfig.ts
export function renderBadge(value: string, colorMap: Record<string, string>) {
  return (
    <span className={`badge ${colorMap[value] || 'bg-gray-100'}`}>
      {value}
    </span>
  );
}

export function formatCurrency(value: number, currency: string = 'CAD') {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency
  }).format(value);
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-CA');
}
```

#### 5. **Universal Kanban Columns Hook**

**Location:** `apps/web/src/lib/hooks/useKanbanColumns.ts`

```typescript
/**
 * Settings-driven Kanban column hook
 * Loads stage configuration from settings API
 */
export function useKanbanColumns(
  config: EntityConfig | null,
  data: any[]
): {
  columns: KanbanColumn[];
  loading: boolean;
  error: string | null;
} {
  // Extracts category from config.kanban.metaTable
  // Fetches from /api/v1/setting?category={category}
  // Returns columns for ALL configured stages
  // No fallbacks - empty array or error on failure
}

// Usage
const { columns, loading, error } = useKanbanColumns(taskConfig, tasks);
```

**Settings API Flow:**
```typescript
// Entity config specifies settings table
task.kanban.metaTable = 'setting_datalabel_task_stage'

// Hook extracts category
category = 'task_stage'

// Fetches settings
GET /api/v1/setting?category=task_stage

// Returns 7 configured stages
[
  { level_name: "Backlog", sort_order: 1, color_code: "#6B7280" },
  { level_name: "To Do", sort_order: 2, color_code: "#3B82F6" },
  { level_name: "In Progress", sort_order: 3, color_code: "#F59E0B" },
  { level_name: "In Review", sort_order: 4, color_code: "#8B5CF6" },
  { level_name: "Blocked", sort_order: 5, color_code: "#EF4444" },
  { level_name: "Done", sort_order: 6, color_code: "#10B981" },
  { level_name: "Cancelled", sort_order: 7, color_code: "#9CA3AF" }
]

// Creates columns for ALL stages (even empty ones)
// Groups tasks by stage field
```

### Entity Relationships

#### Project Relationships

```
Project (Parent)
  ├─ Business (via entity_id_map)
  │   └─ Which business unit owns this project
  ├─ Office (via entity_id_map)
  │   └─ Which office manages this project
  ├─ Employees (via manager_employee_id, sponsor_employee_id, stakeholder_employee_ids[])
  │   └─ Team assignments
  └─ Children (via entity_id_map)
      ├─ Tasks → Direct child entities (work items)
      ├─ Wiki → Documentation and knowledge base
      ├─ Artifacts → Files and documents
      └─ Forms → Data collection and approvals
```

**Database Query:**
```sql
-- Get all tasks for a project
SELECT t.* FROM d_task t
INNER JOIN entity_id_map eim ON eim.child_entity_id = t.id::text
WHERE eim.parent_entity_id = '93106ffb-402e-43a7-8b26-5287e37a1b0e'
  AND eim.parent_entity_type = 'project'
  AND eim.child_entity_type = 'task'
  AND eim.active_flag = true
  AND t.active_flag = true;
```

#### Task Relationships

```
Task (Child)
  ├─ Project (via entity_id_map)
  │   └─ Parent project container
  ├─ Employees (via entity_id_map, relationship_type='assigned_to')
  │   └─ Multi-user assignments managed via linkage API
  └─ Children (via entity_id_map)
      ├─ Artifacts → Task deliverables and attachments
      └─ Forms → Task-specific data collection
```

**Task Assignee Query:**
```sql
-- Get all assignees for a task
SELECT e.id, e.name, e.email, map.id as linkage_id
FROM app.d_employee e
INNER JOIN app.d_entity_id_map map ON map.child_entity_id = e.id::text
WHERE map.parent_entity_type = 'task'
  AND map.parent_entity_id = $task_id
  AND map.child_entity_type = 'employee'
  AND map.relationship_type = 'assigned_to'
  AND map.active_flag = true;
```

### Relationship Mapping Table

**Location:** `db/33_d_entity_id_map.ddl`

```sql
-- Stores ALL parent-child relationships without foreign keys
CREATE TABLE app.d_entity_id_map (
    id uuid PRIMARY KEY,
    parent_entity_type varchar(20),  -- 'project', 'business', 'office'
    parent_entity_id text,           -- UUID as string
    child_entity_type varchar(20),   -- 'task', 'wiki', 'artifact'
    child_entity_id text,            -- UUID as string
    relationship_type varchar(50),   -- 'contains', 'owns', 'documents'
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Auto-populated on task creation
INSERT INTO entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('project', $project_id, 'task', $new_task_id);
```

**Valid Relationships:**
```
project → task, artifact, wiki, form
business → project, task, artifact, wiki, form
office → business, task, artifact, wiki, form
client → project, artifact, form
task → artifact, form, employee (assignees)
```

---

## Central Configuration & Middleware

### Entity Configuration Registry

**Location:** `apps/web/src/lib/entityConfig.ts:173-351`

```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  project: {
    name: 'project',
    displayName: 'Project',
    pluralName: 'Projects',
    apiEndpoint: '/api/v1/project',

    columns: [
      {
        key: 'name',
        title: 'Project Name',
        sortable: true,
        filterable: true,
        render: (value, record) => (
          <div>
            <div className="font-medium">{value}</div>
            <div className="text-sm text-gray-500">{record.code}</div>
          </div>
        )
      },
      {
        key: 'project_stage',
        title: 'Stage',
        sortable: true,
        inlineEditable: true,
        loadOptionsFromSettings: true,  // → /api/v1/setting?category=project_stage
        render: (value) => renderBadge(value, stageColorMap)
      },
      {
        key: 'budget_allocated',
        title: 'Budget',
        align: 'right',
        render: (value, record) => formatCurrency(value, record.budget_currency)
      }
    ],

    fields: [
      { key: 'name', label: 'Project Name', type: 'text', required: true },
      { key: 'project_stage', label: 'Stage', type: 'select', loadOptionsFromSettings: true },
      { key: 'budget_allocated', label: 'Budget', type: 'number' },
      { key: 'planned_start_date', label: 'Start Date', type: 'date' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  task: {
    name: 'task',
    displayName: 'Task',
    pluralName: 'Tasks',
    apiEndpoint: '/api/v1/task',
    shareable: true,  // Enables public shared URLs

    columns: [
      { key: 'name', title: 'Task Name', sortable: true, filterable: true },
      {
        key: 'stage',
        title: 'Stage',
        inlineEditable: true,
        loadOptionsFromSettings: true  // → /api/v1/setting?category=task_stage
      },
      {
        key: 'priority_level',
        title: 'Priority',
        inlineEditable: true,
        loadOptionsFromSettings: true  // → /api/v1/setting?category=task_priority
      }
    ],

    fields: [
      { key: 'name', label: 'Task Name', type: 'text', required: true },
      { key: 'stage', label: 'Stage', type: 'select', loadOptionsFromSettings: true },
      { key: 'priority_level', label: 'Priority', type: 'select', loadOptionsFromSettings: true },
      { key: 'estimated_hours', label: 'Estimated Hours', type: 'number' }
    ],

    supportedViews: ['table', 'kanban'],
    defaultView: 'table',

    kanban: {
      groupByField: 'stage',
      metaTable: 'setting_task_stage',
      cardFields: ['name', 'priority_level', 'estimated_hours', 'assignee_employee_ids']
    }
  }
};

// Getter function with validation
export function getEntityConfig(entityType: string): EntityConfig {
  const config = entityConfigs[entityType];
  if (!config) {
    throw new Error(`Entity configuration not found: ${entityType}`);
  }
  return config;
}
```

### API Middleware & RBAC

**Location:** `apps/api/src/modules/rbac/entity-permission-rbac-gate.ts`

```typescript
// RBAC permissions checked on every API call
export async function hasPermissionOnEntityId(
  empid: string,
  entity: string,
  entityId: string,
  action: EntityAction  // 0=view, 1=edit, 2=share, 3=delete, 4=create
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT permission
    FROM entity_id_rbac_map
    WHERE empid = ${empid}
      AND entity = ${entity}
      AND (entity_id = ${entityId} OR entity_id = 'all')
      AND active_flag = true
  `);

  return result.some(row => row.permission.includes(action));
}

// Example: Check if user can edit project
if (!await hasPermissionOnEntityId(userId, 'project', projectId, 1)) {
  return reply.status(403).send({ error: 'Forbidden' });
}
```

**RBAC Table:** `db/34_d_entity_id_rbac_map.ddl`

```sql
CREATE TABLE app.entity_id_rbac_map (
    empid uuid,                    -- Employee UUID
    entity varchar(20),            -- 'project', 'task', 'business'
    entity_id text,                -- Specific UUID or 'all'
    permission integer[],          -- {0,1,2,3,4} = {view,edit,share,delete,create}
    active_flag boolean DEFAULT true
);

-- James Miller has full access to all projects
INSERT INTO entity_id_rbac_map (empid, entity, entity_id, permission)
VALUES ('8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'project', 'all', '{0,1,2,3,4}');

-- James Miller has full access to all tasks
INSERT INTO entity_id_rbac_map (empid, entity, entity_id, permission)
VALUES ('8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'task', 'all', '{0,1,2,3,4}');
```

### Settings API

**Location:** `apps/api/src/modules/meta/routes.ts`

```typescript
// GET /api/v1/setting?category=project_stage
fastify.get('/api/v1/setting', async (request, reply) => {
  const { category } = request.query;

  // Map category to settings table
  const tableMap = {
    'project_stage': 'setting_datalabel_project_stage',
    'task_stage': 'setting_datalabel_task_stage',
    'task_priority': 'setting_datalabel_task_priority'
  };

  const table = tableMap[category];
  const result = await db.execute(sql`
    SELECT level_id as value, level_name as label, sort_order as order
    FROM app.${table}
    WHERE active_flag = true
    ORDER BY sort_order ASC
  `);

  return { category, options: result };
});
```

**Settings Tables:**
```
db/setting_datalabel__project_stage.ddl
db/setting_datalabel__task_stage.ddl
db/setting_datalabel__task_priority.ddl
```

---

## User Interaction Flow Examples

### Example 1: Project Manager Creates Task

**User Actions:**
1. Navigate to `/project/93106ffb-402e-43a7-8b26-5287e37a1b0e`
2. Click "Tasks" tab → Navigate to `/project/{id}/task`
3. Click "+ New Task" button
4. Fill form:
   - Name: "Implement API endpoints"
   - Stage: "Backlog" (dropdown from settings)
   - Priority: "High" (dropdown from settings)
   - Estimated Hours: 24
5. Click "Save"

**System Flow:**
```
Frontend                           API                                Database
--------                           ---                                --------
1. User clicks "+ New Task"
   └→ Opens EntityEditModal

2. Form fields render
   └→ GET /api/v1/setting?category=task_stage
   └→ GET /api/v1/setting?category=task_priority
                                   ├→ SELECT FROM setting_datalabel_task_stage
                                   └→ SELECT FROM setting_datalabel_task_priority
   ←─ Returns dropdown options

3. User submits form
   └→ POST /api/v1/task
      Body: {
        name: "Implement API endpoints",
        stage: "Backlog",
        priority_level: "high",
        estimated_hours: 24
      }
                                   ├→ RBAC check: hasCreatePermissionForEntityType('task')
                                   ├→ INSERT INTO d_task (...)
                                   └→ INSERT INTO entity_id_map (
                                        parent_entity_type: 'project',
                                        parent_entity_id: '93106ffb...',
                                        child_entity_type: 'task',
                                        child_entity_id: new_uuid
                                      )
   ←─ Returns created task

4. Frontend refreshes task list
   └→ GET /api/v1/project/93106ffb.../task
                                   ├→ SELECT t.* FROM d_task t
                                      INNER JOIN entity_id_map eim ...
                                      WHERE eim.parent_entity_id = '93106ffb...'
   ←─ Returns updated task list with new task
```

### Example 2: Inline Edit Project Stage

**User Actions:**
1. Navigate to `/project`
2. Click on "Planning" badge in project_stage column
3. Select "Execution" from dropdown
4. Badge automatically updates

**System Flow:**
```
Frontend                           API                                Database
--------                           ---                                --------
1. User clicks stage badge
   └→ FilteredDataTable enables inline editing
   └→ Renders dropdown with cached settings

2. User selects "Execution"
   └→ PUT /api/v1/project/93106ffb...
      Body: { project_stage: "Execution" }
                                   ├→ RBAC check: hasPermissionOnEntityId('project', id, 1)
                                   ├→ UPDATE d_project
                                      SET project_stage = 'Execution',
                                          version = version + 1,
                                          updated_ts = now()
                                      WHERE id = '93106ffb...'
   ←─ Returns updated project

3. Frontend updates UI
   └→ Re-renders badge with new value and color
   └→ Shows toast: "Project stage updated"
```

### Example 3: Drag Task Card in Kanban

**User Actions:**
1. Navigate to `/task` with view mode set to "kanban"
2. Drag task card from "To Do" column to "In Progress" column
3. Card moves and stage updates

**System Flow:**
```
Frontend                           API                                Database
--------                           ---                                --------
1. KanbanView loads configuration
   └→ useKanbanColumns hook
   └→ GET /api/v1/setting?category=task_stage
                                   ├→ SELECT FROM setting_datalabel_task_stage
                                      ORDER BY sort_order
   ←─ Returns 7 configured stages
   └→ Creates columns for ALL stages (even empty ones)

2. KanbanView loads task data
   └→ GET /api/v1/task?active=true
                                   ├→ SELECT * FROM d_task WHERE active_flag = true
   ←─ Returns all active tasks
   └→ Groups tasks by 'stage' field into columns

3. User drags card
   └→ onCardMove(taskId, 'To Do', 'In Progress')
   └→ PUT /api/v1/task/a1111111...
      Body: { stage: "In Progress" }
                                   ├→ UPDATE d_task
                                      SET stage = 'In Progress',
                                          version = version + 1,
                                          updated_ts = now()
   ←─ Returns updated task

4. Frontend updates Kanban
   └→ Optimistic update: moves card immediately
   └→ Re-renders KanbanView with updated data
   └→ Card appears in "In Progress" column
```

### Example 4: Share Task with External Stakeholder

**User Actions:**
1. Navigate to `/task/a1111111-1111-1111-1111-111111111111`
2. Scroll to "Share URL" section
3. Click "Copy Shared URL"
4. Send URL to external stakeholder via email

**External Stakeholder Access:**
```
1. Stakeholder receives: https://app.huronhome.ca/task/xT4pQ2nR
2. Clicks link (NO LOGIN REQUIRED)
3. Public task view renders with limited fields:
   - Task name, description
   - Stage, priority
   - Estimated/actual hours
   - Tags
   - NO edit capabilities
   - NO internal metadata
```

**System Flow:**
```
Frontend                           API                                Database
--------                           ---                                --------
1. External user visits /task/xT4pQ2nR
   └→ GET /api/v1/task/shared/xT4pQ2nR
                                   ├→ SELECT * FROM d_task
                                      WHERE shared_url LIKE '%xT4pQ2nR'
                                        AND active_flag = true
   ←─ Returns public task data (sanitized)

2. Frontend renders public view
   └→ ShareableEntityDetailPage
   └→ Shows read-only fields
   └→ Hides edit buttons
   └→ No navigation to other entities
```

---

## Task Assignee Management via Entity Linkage

### Overview
Task assignees are managed via the `entity_id_map` linkage system. This provides consistent relationship management and supports many-to-many task-to-employee assignments.

### Backend Implementation

**How it works:**
1. Task records NO LONGER contain embedded `assignee_employee_ids` array column
2. Assignees are stored in `entity_id_map` with relationship_type='assigned_to'
3. Task GET endpoints automatically fetch assignees via JOIN
4. Task CREATE/UPDATE endpoints do NOT handle assignees directly

**Query Pattern:**
```sql
-- Get task assignees from entity_id_map
SELECT
  e.id, e.name, e.email,
  map.id as linkage_id
FROM app.d_entity_id_map map
INNER JOIN app.d_employee e ON e.id::text = map.child_entity_id
WHERE map.parent_entity_type = 'task'
  AND map.parent_entity_id = '<task-uuid>'
  AND map.child_entity_type = 'employee'
  AND map.relationship_type = 'assigned_to'
  AND map.active_flag = true;
```

### API Endpoints

**Get Task with Assignees (Automatic):**
```typescript
GET /api/v1/task/:id
Response: {
  id: "uuid",
  name: "Task Name",
  assignee_employee_ids: ["uuid1", "uuid2"],      // From entity_id_map
  assignee_employee_names: ["Name 1", "Name 2"], // From entity_id_map
  // ... other fields
}
```

**Get Task Assignees (Explicit):**
```typescript
GET /api/v1/task/:id/assignees
Response: {
  success: true,
  data: [
    {
      id: "employee-uuid",
      name: "Employee Name",
      email: "email@example.com",
      linkage_id: "linkage-uuid"  // For deletion
    }
  ]
}
```

**Add Assignee:**
```typescript
POST /api/v1/linkage
Body: {
  parent_entity_type: "task",
  parent_entity_id: "<task-uuid>",
  child_entity_type: "employee",
  child_entity_id: "<employee-uuid>",
  relationship_type: "assigned_to"
}
```

**Remove Assignee:**
```typescript
DELETE /api/v1/linkage/:linkageId
```

### Frontend Integration

#### Task Creation (Two-Step Process)

**Step 1: Create Task**
```typescript
// apps/web/src/components/entity/form/FormBuilder.tsx
const handleSubmit = async (formData) => {
  const { assignee_employee_ids, ...taskData } = formData;

  // Create task WITHOUT assignees
  const response = await fetch('/api/v1/task', {
    method: 'POST',
    body: JSON.stringify(taskData)
  });

  const newTask = await response.json();

  // Step 2: Add assignees via linkage API
  if (assignee_employee_ids?.length > 0) {
    await Promise.all(
      assignee_employee_ids.map(employeeId =>
        fetch('/api/v1/linkage', {
          method: 'POST',
          body: JSON.stringify({
            parent_entity_type: 'task',
            parent_entity_id: newTask.id,
            child_entity_type: 'employee',
            child_entity_id: employeeId,
            relationship_type: 'assigned_to'
          })
        })
      )
    );
  }

  navigate(`/task/${newTask.id}`);
};
```

#### Task Update (Separate Assignee Management)

```typescript
// apps/web/src/components/shared/entity/EntityFormContainer.tsx
const handleSubmit = async (formData) => {
  const { assignee_employee_ids, ...taskData } = formData;

  // Update task fields (WITHOUT assignees)
  await fetch(`/api/v1/task/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(taskData)
  });

  // Update assignees separately
  if (assignee_employee_ids !== undefined) {
    await updateTaskAssignees(taskId, assignee_employee_ids);
  }
};

async function updateTaskAssignees(taskId: string, newIds: string[]) {
  // 1. Get current assignees
  const { data: current } = await fetch(`/api/v1/task/${taskId}/assignees`).then(r => r.json());

  // 2. Remove unselected assignees
  const toRemove = current.filter(a => !newIds.includes(a.id));
  await Promise.all(
    toRemove.map(a => fetch(`/api/v1/linkage/${a.linkage_id}`, { method: 'DELETE' }))
  );

  // 3. Add new assignees
  const currentIds = current.map(a => a.id);
  const toAdd = newIds.filter(id => !currentIds.includes(id));
  await Promise.all(
    toAdd.map(id =>
      fetch('/api/v1/linkage', {
        method: 'POST',
        body: JSON.stringify({
          parent_entity_type: 'task',
          parent_entity_id: taskId,
          child_entity_type: 'employee',
          child_entity_id: id,
          relationship_type: 'assigned_to'
        })
      })
    )
  );
}
```

#### Assignee Selector Component

```typescript
// apps/web/src/components/entity/AssigneeSelector.tsx
export const AssigneeSelector: React.FC<{
  taskId: string;
  value?: string[];
  onChange?: (ids: string[]) => void;
}> = ({ taskId, value = [], onChange }) => {
  const [assignees, setAssignees] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/v1/task/${taskId}/assignees`)
      .then(r => r.json())
      .then(({ data }) => setAssignees(data));
  }, [taskId]);

  const handleAdd = async (employeeId: string) => {
    await fetch('/api/v1/linkage', {
      method: 'POST',
      body: JSON.stringify({
        parent_entity_type: 'task',
        parent_entity_id: taskId,
        child_entity_type: 'employee',
        child_entity_id: employeeId,
        relationship_type: 'assigned_to'
      })
    });
    // Refresh assignees
  };

  const handleRemove = async (linkageId: string) => {
    await fetch(`/api/v1/linkage/${linkageId}`, { method: 'DELETE' });
    // Refresh assignees
  };

  return (
    <div>
      {assignees.map(a => (
        <span key={a.id}>
          {a.name}
          <button onClick={() => handleRemove(a.linkage_id)}>×</button>
        </span>
      ))}
      <select onChange={(e) => handleAdd(e.target.value)}>
        <option>Add assignee...</option>
        {/* Map employees */}
      </select>
    </div>
  );
};
```

### Migration Checklist

**What Works Automatically:**
- ✅ Viewing tasks with assignees (GET endpoints return assignee data)
- ✅ Task lists display assignee names
- ✅ Task detail pages show current assignees
- ✅ Kanban boards include assignee information

**What Needs Frontend Updates:**
- ⚠️ Task creation forms must use two-step process (create task + add assignees)
- ⚠️ Task edit forms must manage assignees via linkage API
- ⚠️ Inline assignee editing must call linkage API directly
- ⚠️ Assignee selector components need linkage API integration

**Testing Commands:**
```bash
# Create task
./tools/test-api.sh POST /api/v1/task '{"name":"New Task","stage":"To Do"}'

# Add assignee (use returned task ID)
./tools/test-api.sh POST /api/v1/linkage '{
  "parent_entity_type":"task",
  "parent_entity_id":"<task-uuid>",
  "child_entity_type":"employee",
  "child_entity_id":"<employee-uuid>",
  "relationship_type":"assigned_to"
}'

# Get task assignees
./tools/test-api.sh GET /api/v1/task/<task-uuid>/assignees
```

---

## Critical Considerations When Editing

### ⚠️ Breaking Changes to Avoid

#### 1. **Never Change Entity IDs**
```typescript
// ❌ DANGEROUS: Changing IDs breaks all relationships
UPDATE d_project SET id = gen_random_uuid() WHERE id = $old_id;

// ✅ SAFE: IDs are stable; update other fields instead
UPDATE d_project SET name = $new_name WHERE id = $id;
```

**Why:** Child entities reference parent via `entity_id_map`. Changing parent ID orphans all children.

#### 2. **Preserve `entity_id_map` Integrity**
```sql
-- ❌ DANGEROUS: Deleting mapping orphans child entity
DELETE FROM entity_id_map WHERE child_entity_id = $task_id;

-- ✅ SAFE: Soft delete maintains relationship history
UPDATE entity_id_map SET active_flag = false WHERE child_entity_id = $task_id;
```

**Why:** Hard deletes prevent relationship auditing and break entity navigation.

#### 3. **Don't Bypass RBAC Checks**
```typescript
// ❌ DANGEROUS: Direct database query without RBAC
const result = await db.execute(sql`SELECT * FROM d_project WHERE id = ${id}`);

// ✅ SAFE: Use middleware with RBAC gate
fastify.get('/api/v1/project/:id', {
  preHandler: [fastify.authenticate, fastify.authorizeEntity],
  // ... RBAC checks before returning data
});
```

**Why:** Users might access entities they shouldn't see; security vulnerability.

#### 4. **Maintain Settings Table Naming Convention**
```sql
-- ❌ DANGEROUS: Renaming breaks frontend lookups
ALTER TABLE setting_datalabel_task_stage RENAME TO task_stages;

-- ✅ SAFE: Keep snake_case naming with setting_datalabel_ prefix
-- Frontend expects: setting_datalabel_{category_name}
```

**Why:** `loadOptionsFromSettings` dynamically maps field keys to table names. Renaming breaks dropdowns.

#### 5. **Version Increment on Updates**
```sql
-- ❌ DANGEROUS: Forgetting version increment loses audit trail
UPDATE d_task SET stage = $1 WHERE id = $2;

-- ✅ SAFE: Always increment version for audit trail
UPDATE d_task SET stage = $1, version = version + 1, updated_ts = now() WHERE id = $2;
```

**Why:** Version field tracks change history; critical for compliance and debugging.

---

### 🔧 Safe Modification Patterns

#### Adding New Project Field

**1. Database DDL** (`db/18_d_project.ddl`)
```sql
ALTER TABLE app.d_project ADD COLUMN risk_level varchar(20);
```

**2. Entity Configuration** (`apps/web/src/lib/entityConfig.ts`)
```typescript
entityConfigs.project.columns.push({
  key: 'risk_level',
  title: 'Risk Level',
  sortable: true,
  inlineEditable: true,
  loadOptionsFromSettings: true  // If dropdown needed
});

entityConfigs.project.fields.push({
  key: 'risk_level',
  label: 'Risk Level',
  type: 'select',
  loadOptionsFromSettings: true
});
```

**3. Settings Table** (if dropdown needed)
```sql
-- db/setting_datalabel__project_risk_level.ddl
CREATE TABLE app.setting_datalabel_project_risk_level (
    level_id varchar(50) PRIMARY KEY,
    level_name varchar(100) NOT NULL,
    sort_order integer NOT NULL,
    active_flag boolean DEFAULT true
);

INSERT INTO app.setting_datalabel_project_risk_level VALUES
('low', 'Low Risk', 1, true),
('medium', 'Medium Risk', 2, true),
('high', 'High Risk', 3, true);
```

**4. API Settings Route** (auto-handled if naming convention followed)
```typescript
// No changes needed! API auto-maps:
// category=project_risk_level → setting_datalabel_project_risk_level
```

#### Adding Task Dependency Validation

**1. API Middleware** (`apps/api/src/modules/entity/task-routes.ts`)
```typescript
fastify.addHook('preHandler', async (request, reply) => {
  if (request.method === 'PUT' && request.body.stage === 'In Progress') {
    const task = await db.getTask(request.params.id);

    // Check if all dependency tasks are complete
    if (task.dependency_task_ids?.length) {
      const dependencies = await db.execute(sql`
        SELECT id, stage FROM d_task
        WHERE id = ANY(${task.dependency_task_ids})
      `);

      const incomplete = dependencies.filter(d => d.stage !== 'Done');
      if (incomplete.length > 0) {
        return reply.status(400).send({
          error: 'Cannot start task until dependencies are complete',
          incomplete_dependencies: incomplete
        });
      }
    }
  }
});
```

**2. Frontend Validation** (`apps/web/src/components/entity/task/TaskDependencyChecker.tsx`)
```typescript
function TaskDependencyChecker({ task, onStageChange }) {
  const { dependencies, loading } = useTaskDependencies(task.dependency_task_ids);

  const incompleteDeps = dependencies?.filter(d => d.stage !== 'Done') || [];

  if (incompleteDeps.length > 0 && targetStage === 'In Progress') {
    return (
      <Alert variant="warning">
        Cannot start task. Waiting on:
        {incompleteDeps.map(d => <li>{d.name}</li>)}
      </Alert>
    );
  }

  return <StageSelector task={task} onChange={onStageChange} />;
}
```

---

### 📝 Testing Checklist

When modifying project or task logic, verify:

- [ ] **Database migrations** run without errors
- [ ] **Entity configuration** updates reflected in UI
- [ ] **API endpoints** return correct data structure
- [ ] **RBAC checks** still enforce permissions correctly
- [ ] **Settings dropdowns** load options properly
- [ ] **Inline editing** saves changes and refreshes UI
- [ ] **Parent-child navigation** works via tabs
- [ ] **Kanban drag-drop** updates task stages
- [ ] **Shared URLs** work without authentication
- [ ] **Search/filter/sort** functions correctly
- [ ] **Pagination** handles large datasets
- [ ] **Error handling** shows user-friendly messages
- [ ] **Version incrementing** tracks change history
- [ ] **Soft deletes** preserve relationships
- [ ] **Audit logs** capture who/when/what changed

---

### 🧪 Testing Commands

```bash
# Start platform
./tools/start-all.sh

# Test project API
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh GET /api/v1/project/93106ffb-402e-43a7-8b26-5287e37a1b0e
./tools/test-api.sh POST /api/v1/project '{"name":"Test Project","code":"TEST-001","slug":"test-project","project_stage":"Initiation"}'
./tools/test-api.sh PUT /api/v1/project/93106ffb-402e-43a7-8b26-5287e37a1b0e '{"project_stage":"Execution"}'

# Test task API
./tools/test-api.sh GET /api/v1/task
./tools/test-api.sh GET /api/v1/project/93106ffb-402e-43a7-8b26-5287e37a1b0e/task
./tools/test-api.sh POST /api/v1/task '{"name":"Test Task","code":"TEST-TASK-001","slug":"test-task","stage":"Backlog","priority_level":"medium"}'
./tools/test-api.sh PUT /api/v1/task/a1111111-1111-1111-1111-111111111111 '{"stage":"In Progress"}'

# Test settings API
./tools/test-api.sh GET /api/v1/setting?category=project_stage
./tools/test-api.sh GET /api/v1/setting?category=task_stage
./tools/test-api.sh GET /api/v1/setting?category=task_priority

# Test child entity tabs
./tools/test-api.sh GET /api/v1/entity/child-tabs/project/93106ffb-402e-43a7-8b26-5287e37a1b0e

# View logs
./tools/logs-api.sh -f
./tools/logs-web.sh -f

# Reset database
./tools/db-import.sh
```

---

## 📚 Related Documentation

- **[Database Schema](../db/README.md)** - Complete DDL reference
- **[API Guide](../apps/api/README.md)** - Backend architecture
- **[Frontend Guide](../apps/web/README.md)** - UI/UX patterns
- **[Entity Configuration](../apps/web/src/lib/entityConfig.ts)** - Configuration reference
- **[RBAC System](../db/34_d_entity_id_rbac_map.ddl)** - Permission model
- **[Settings System](../db/setting_datalabel__*.ddl)** - Dropdown configuration
- **[Standardized Kanban System](./Standardized_Kanban_System.md)** - Settings-driven Kanban architecture

---

## 🎯 Summary

**Projects** and **Tasks** form the backbone of the PMO platform's work management capabilities:

- **Projects** organize strategic initiatives with financial and timeline tracking
- **Tasks** break down projects into actionable work items with Kanban workflow
- **Universal patterns** ensure consistent behavior across all entities
- **DRY principles** minimize code duplication and maintenance burden
- **Settings-driven** dropdowns enable business users to customize workflows
- **RBAC integration** ensures secure access control at entity and field level
- **Flexible relationships** via `entity_id_map` support complex hierarchies
- **Public sharing** via presigned URLs enables external collaboration

**Key Principles:**
- Change entity configuration once in `entityConfig.ts` → updates propagate everywhere automatically
- Kanban columns load from settings API → business users control stage configuration
- No hardcoded fallbacks → errors display clearly for proper resolution
- Single source of truth → consistent experience across all views
