# PMO Application - Complete Architecture Documentation

## Table of Contents
1. [Page Architecture Overview](#page-architecture-overview)
2. [Entity Main Page (List View)](#entity-main-page-list-view)
3. [Entity Detail Page (Overview)](#entity-detail-page-overview)
4. [Entity Child List Page (Nested View)](#entity-child-list-page-nested-view)
5. [Component Interaction Flow](#component-interaction-flow)
6. [API Integration Patterns](#api-integration-patterns)
7. [Routing Architecture](#routing-architecture)
8. [Data Flow Diagrams](#data-flow-diagrams)

---

## Page Architecture Overview

### 3-Page Universal System

The PMO application uses a **3-page universal architecture** where ALL entities (project, task, wiki, artifact, form, business, organization, employee, role, client, worksite, position) share the same three page components:

| Page Component | File | Purpose | URL Pattern |
|----------------|------|---------|-------------|
| **EntityMainPage** | `apps/web/src/pages/EntityMainPage.tsx` | List all entities of a type | `/{entityType}` |
| **EntityDetailPage** | `apps/web/src/pages/EntityDetailPage.tsx` | Show entity details with tabs | `/{entityType}/{id}` |
| **EntityChildListPage** | `apps/web/src/pages/EntityChildListPage.tsx` | Show filtered child entities | `/{parentType}/{id}/{childType}` |

### Configuration-Driven Design

All entity-specific behavior is controlled by **entityConfig.ts**:
- Column definitions for tables
- Field definitions for forms
- View modes (table, kanban, grid)
- Child entity relationships
- Kanban/Grid configurations

---

## Entity Main Page (List View)

### File: `apps/web/src/pages/EntityMainPage.tsx`

### Purpose
Displays a **list of all entities** of a specific type with multiple view options (table, kanban, grid).

### URL Patterns
```
/project → All projects
/task → All tasks
/wiki → All wiki entries
/artifact → All artifacts
/form → All forms
/biz → All business units
/org → All organizations
/employee → All employees
/role → All roles
/client → All clients
/worksite → All worksites
/position → All positions
```

### Component Structure

```tsx
<Layout>  {/* Full layout with sidebar */}
  <div className="max-w-7xl mx-auto">
    {/* HEADER SECTION */}
    <div className="header">
      <div className="title-area">
        <Icon /> {/* Entity icon */}
        <h1>{config.pluralName}</h1>
        <p>Manage and track {pluralName}</p>
      </div>
      <div className="controls">
        <ViewSwitcher /> {/* Table/Kanban/Grid toggle */}
        <CreateButton /> {/* Create new entity */}
      </div>
    </div>

    {/* CONTENT SECTION */}
    <div className="content">
      {view === 'table' && (
        <FilteredDataTable
          entityType={entityType}
          showActionButtons={false}
          onBulkShare={handleBulkShare}
          onBulkDelete={handleBulkDelete}
          onRowClick={handleRowClick}
        />
      )}
      {view === 'kanban' && (
        <KanbanBoard
          columns={kanbanColumns}
          onCardClick={handleRowClick}
          onCardMove={handleCardMove}
        />
      )}
      {view === 'grid' && (
        <GridView
          items={data}
          onItemClick={handleRowClick}
          columns={3}
        />
      )}
    </div>
  </div>
</Layout>
```

### Interaction Flow

#### 1. **Page Load**
```
User navigates to /project
  ↓
EntityMainPage renders with entityType="project"
  ↓
getEntityConfig('project') loads configuration
  ↓
Check supported views: ['table', 'kanban', 'grid']
  ↓
useViewMode() checks localStorage for saved view preference
  ↓
If view === 'table': Render FilteredDataTable (API calls handled by table)
If view === 'kanban' or 'grid': Call loadData() to fetch all entities
  ↓
Display data in selected view
```

#### 2. **View Switching**
```
User clicks Kanban icon in ViewSwitcher
  ↓
setView('kanban') called
  ↓
useViewMode() saves preference to localStorage
  ↓
useEffect detects view change
  ↓
loadData() fetches all entities via projectApi.list()
  ↓
kanbanColumns computed from data
  ↓
KanbanBoard renders with grouped columns
```

#### 3. **Row/Card Click**
```
User clicks on a project row/card
  ↓
handleRowClick(item) fires
  ↓
navigate(`/project/${item.id}`)
  ↓
EntityDetailPage loads
```

#### 4. **Create Button Click**
```
User clicks "Create Project" button
  ↓
handleCreateClick() fires
  ↓
navigate('/project/new')
  ↓
Project creation form loads (not shown in this doc)
```

### Data Loading Strategy

**Table View**:
- FilteredDataTable handles its own API calls
- Supports server-side pagination, sorting, filtering
- More efficient for large datasets

**Kanban/Grid View**:
- EntityMainPage loads all data upfront
- Client-side grouping and rendering
- Better for smaller datasets with complex visualizations

### API Calls

```typescript
// For Kanban/Grid views
const apiModule = api.projectApi; // Dynamic: api[`${entityType}Api`]
const response = await apiModule.list({
  page: 1,
  pageSize: 100
});
setData(response.data);
```

---

## Entity Detail Page (Overview)

### File: `apps/web/src/pages/EntityDetailPage.tsx`

### Purpose
Displays **detailed information** about a single entity with:
- Overview tab showing entity fields
- Dynamic child entity tabs (tasks, wiki, artifacts, forms)
- Inline editing capability
- Nested routing for child entities

### URL Patterns
```
/project/84215ccb-313d-48f8-9c37-4398f28c0b1f → Project overview
/project/84215ccb-313d-48f8-9c37-4398f28c0b1f/task → Project's tasks
/project/84215ccb-313d-48f8-9c37-4398f28c0b1f/wiki → Project's wiki entries
/task/abc123 → Task overview
/biz/def456 → Business unit overview
/biz/def456/project → Business unit's projects
```

### Component Structure

```tsx
<Layout>  {/* Full layout with sidebar */}
  <div className="max-w-7xl mx-auto">
    {/* HEADER SECTION */}
    <div className="header">
      <button onClick={handleBack}>← Back</button>
      <div className="title">
        <h1>{data.name || data.title}</h1>
        <p>{config.displayName} · {id}</p>
      </div>
      <div className="actions">
        {!isEditing && <EditButton />}
        {isEditing && <><CancelButton /> <SaveButton /></>}
      </div>
    </div>

    {/* TABS SECTION */}
    <DynamicChildEntityTabs
      title={data.name}
      parentType={entityType}
      parentId={id}
      parentName={data.name}
      tabs={allTabs} // [Overview, Tasks (5), Wiki (3), ...]
      showBackButton={false}
    />

    {/* CONTENT AREA */}
    {isOverviewTab ? (
      // OVERVIEW TAB - Entity Details
      <div className="entity-details">
        <h2>{config.displayName} Information</h2>
        <div className="grid grid-cols-2 gap-6">
          {config.fields.map(field => (
            <div key={field.key}>
              <label>{field.label}</label>
              <div>{renderField(field)}</div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      // CHILD ENTITY TAB - Nested Route
      <Outlet /> {/* Renders EntityChildListPage */}
    )}
  </div>
</Layout>
```

### Interaction Flow - Complete Breakdown

#### 1. **Initial Page Load**
```
User clicks project in list → navigate('/project/84215ccb...')
  ↓
React Router matches route:
  <Route path="/project/:id" element={<EntityDetailPage entityType="project" />}>
    <Route path="task" element={<EntityChildListPage parentType="project" childType="task" />} />
    <Route path="wiki" element={<EntityChildListPage parentType="project" childType="wiki" />} />
    ...
  </Route>
  ↓
EntityDetailPage component mounts
  ↓
const { id } = useParams(); // Extract '84215ccb...' from URL
const config = getEntityConfig('project'); // Load project configuration
  ↓
useEffect(() => loadData(), [id, entityType]) fires
  ↓
┌─────────────────────────────────────────────────────────┐
│ loadData() function executes:                           │
│                                                          │
│ 1. setLoading(true)                                     │
│ 2. const apiModule = api.projectApi                    │
│ 3. const response = await apiModule.get(id)             │
│    → API: GET /api/v1/project/84215ccb...              │
│ 4. setData(response.data)                               │
│ 5. setEditedData(response.data) // For editing         │
│ 6. setLoading(false)                                    │
└─────────────────────────────────────────────────────────┘
  ↓
Parallel: useDynamicChildEntityTabs('project', id) hook fires
  ↓
┌─────────────────────────────────────────────────────────┐
│ useDynamicChildEntityTabs hook:                         │
│                                                          │
│ 1. Get auth token from localStorage                     │
│ 2. Fetch action summaries:                              │
│    → API: GET /api/v1/project/84215ccb.../             │
│              dynamic-child-entity-tabs                  │
│ 3. Response:                                            │
│    {                                                    │
│      "action_entities": [                              │
│        { "actionEntity": "task", "label": "Tasks",     │
│          "count": 5, "canCreate": true },              │
│        { "actionEntity": "wiki", "label": "Wiki",      │
│          "count": 3, "canCreate": true },              │
│        { "actionEntity": "artifact", "label":          │
│          "Artifacts", "count": 8, "canCreate": true }, │
│        { "actionEntity": "form", "label": "Forms",     │
│          "count": 2, "canCreate": true }               │
│      ]                                                  │
│    }                                                    │
│ 4. Transform to HeaderTab[] format:                    │
│    [                                                    │
│      { id: 'overview', label: 'Overview',              │
│        path: '/project/84215ccb...', icon: ... },      │
│      { id: 'task', label: 'Tasks', count: 5,           │
│        path: '/project/84215ccb.../task', icon: ... }, │
│      { id: 'wiki', label: 'Wiki', count: 3,            │
│        path: '/project/84215ccb.../wiki', icon: ... }, │
│      ...                                                │
│    ]                                                    │
│ 5. setTabs(generatedTabs)                              │
└─────────────────────────────────────────────────────────┘
  ↓
allTabs computed with Overview prepended:
  const allTabs = useMemo(() => {
    const overviewTab = { id: 'overview', label: 'Overview', ... };
    return [overviewTab, ...tabs];
  }, [tabs, entityType, id]);
  ↓
location.pathname analyzed to determine current tab:
  const pathParts = location.pathname.split('/').filter(Boolean);
  // [' project', '84215ccb...']
  const currentChildEntity = pathParts.length > 2 ? pathParts[2] : null;
  // null (no third segment)
  const isOverviewTab = !currentChildEntity; // true
  ↓
Render page with:
  - Header showing "Fall 2024 Landscaping Campaign"
  - DynamicChildEntityTabs with [Overview, Tasks(5), Wiki(3), Artifacts(8), Forms(2)]
  - Content area showing Overview tab (entity fields)
```

#### 2. **Click on Tasks Tab**
```
User clicks "Tasks (5)" tab
  ↓
DynamicChildEntityTabs handleTabClick() fires
  ↓
navigate('/project/84215ccb.../task')
  ↓
URL changes but EntityDetailPage STAYS MOUNTED (nested routing)
  ↓
location changes detected by:
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  // ['project', '84215ccb...', 'task']
  const currentChildEntity = pathParts[2]; // 'task'
  const isOverviewTab = !currentChildEntity; // false
  ↓
Conditional rendering switches:
  {isOverviewTab ? (
    // This block is NOT rendered
    <EntityDetails />
  ) : (
    // This block IS rendered
    <Outlet /> // React Router renders nested route
  )}
  ↓
React Router matches nested route:
  <Route path="task" element={<EntityChildListPage ... />} />
  ↓
EntityChildListPage mounts with:
  - parentType="project"
  - childType="task"
  - parentId="84215ccb..." (from useParams)
  ↓
EntityChildListPage loads and displays filtered task list
```

#### 3. **Overview Tab Fields Rendering**

When on Overview tab (`isOverviewTab === true`):

```typescript
// Field configuration from entityConfig.ts
config.fields = [
  { key: 'name', label: 'Project Name', type: 'text', required: true },
  { key: 'code', label: 'Project Code', type: 'text', required: true },
  { key: 'slug', label: 'Slug', type: 'text', required: true },
  { key: 'descr', label: 'Description', type: 'richtext' },
  { key: 'project_stage', label: 'Stage', type: 'select', options: [...] },
  { key: 'budget_allocated', label: 'Budget', type: 'number' },
  { key: 'planned_start_date', label: 'Start Date', type: 'date' },
  { key: 'planned_end_date', label: 'End Date', type: 'date' },
  { key: 'tags', label: 'Tags', type: 'array' },
  { key: 'metadata', label: 'Metadata', type: 'jsonb' }
]

// Rendering loop
config.fields.map(field => {
  const value = isEditing ? editedData[field.key] : data[field.key];

  // For 'name' field:
  // field.key = 'name'
  // data[field.key] = data['name'] = 'Fall 2024 Landscaping Campaign'

  return (
    <div key={field.key}>
      <label>{field.label}</label> {/* 'Project Name' */}
      <div>{renderField(field)}</div> {/* 'Fall 2024 Landscaping Campaign' */}
    </div>
  );
})
```

**renderField() Logic:**

```typescript
const renderField = (field: FieldDef) => {
  const value = isEditing ? editedData[field.key] : data[field.key];

  if (!isEditing) {
    // DISPLAY MODE
    switch (field.type) {
      case 'date':
        return new Date(value).toLocaleDateString(); // '9/1/2024'

      case 'array':
        return value.map(tag => (
          <span className="badge">{tag}</span>
        )); // Tags as badges

      case 'jsonb':
        return <pre>{JSON.stringify(value, null, 2)}</pre>; // Pretty JSON

      case 'richtext':
      case 'textarea':
        return <div className="whitespace-pre-wrap">{value}</div>;

      default:
        return value || '-'; // Plain text
    }
  } else {
    // EDIT MODE
    switch (field.type) {
      case 'text':
        return <input value={value} onChange={...} />;

      case 'textarea':
      case 'richtext':
        return <textarea rows={6} value={value} onChange={...} />;

      case 'date':
        return <input type="date" value={value} onChange={...} />;

      case 'select':
        return (
          <select value={value} onChange={...}>
            {field.options.map(opt => (
              <option value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'array':
        return (
          <input
            value={value.join(', ')}
            onChange={e => handleChange(e.target.value.split(','))}
          />
        );

      case 'jsonb':
        return (
          <textarea
            value={JSON.stringify(value, null, 2)}
            onChange={e => handleChange(JSON.parse(e.target.value))}
          />
        );
    }
  }
};
```

#### 4. **Inline Editing Flow**
```
User clicks "Edit" button
  ↓
setIsEditing(true)
  ↓
All renderField() calls switch to edit mode
  ↓
User modifies "Project Name" field
  ↓
onChange handler fires: handleFieldChange('name', newValue)
  ↓
setEditedData(prev => ({ ...prev, name: newValue }))
  ↓
Input re-renders with new value
  ↓
User clicks "Save"
  ↓
handleSave() executes:
  1. const apiModule = api.projectApi
  2. await apiModule.update(id, editedData)
     → API: PUT /api/v1/project/84215ccb...
     → Body: { name: 'New Name', code: 'ABC', ... }
  3. setData(editedData) // Update displayed data
  4. setIsEditing(false) // Exit edit mode
  ↓
Fields switch back to display mode with new values
```

### Tab State Management

The tab system uses **URL-based state** (not React state):

```typescript
// Current tab determined by URL path
const pathParts = location.pathname.split('/');
// '/project/123/task' → ['', 'project', '123', 'task']

const currentChildEntity = pathParts[2]; // 'task' or null
const isOverviewTab = !currentChildEntity;

// Active tab highlighting in DynamicChildEntityTabs
const activeTab = tabs.find(tab => currentPath === tab.path);
```

**Benefits:**
- Back/forward browser buttons work correctly
- Direct URL navigation (bookmarks, sharing)
- No state synchronization needed
- Persistent on page refresh

---

## Entity Child List Page (Nested View)

### File: `apps/web/src/pages/EntityChildListPage.tsx`

### Purpose
Displays a **filtered list of child entities** within a parent context. This page is rendered inside EntityDetailPage's `<Outlet />`.

### URL Patterns
```
/project/84215ccb.../task → Tasks for project 84215ccb
/project/84215ccb.../wiki → Wiki entries for project 84215ccb
/biz/def456/project → Projects for business unit def456
/org/ghi789/employee → Employees for organization ghi789
/task/jkl012/artifact → Artifacts for task jkl012
```

### Component Structure

**IMPORTANT**: This component does **NOT** use `<Layout>`. It's rendered inside EntityDetailPage which already has Layout.

```tsx
// NO <Layout> wrapper!
<div className="h-full flex flex-col space-y-4">
  {/* HEADER SECTION */}
  <div className="header">
    <h2>{config.pluralName}</h2> {/* "Tasks" */}
    <div className="controls">
      <ViewSwitcher /> {/* Table/Kanban/Grid */}
      <CreateButton /> {/* Create Task for this project */}
    </div>
  </div>

  {/* CONTENT SECTION */}
  <div className="content">
    {view === 'table' && (
      <FilteredDataTable
        entityType="task"
        parentType="project"
        parentId="84215ccb..."
        showActionButtons={false}
        onRowClick={handleRowClick}
      />
    )}
    {view === 'kanban' && <KanbanBoard ... />}
    {view === 'grid' && <GridView ... />}
  </div>
</div>
```

### Interaction Flow - Complete Breakdown

#### 1. **Component Mount**
```
EntityDetailPage's <Outlet /> renders EntityChildListPage
  ↓
EntityChildListPage mounts with props:
  - parentType="project"
  - childType="task"
  ↓
const { id: parentId } = useParams(); // Extract parent ID from URL
  // parentId = '84215ccb...'
const config = getEntityConfig('task'); // Task configuration
const parentConfig = getEntityConfig('project'); // Parent config
  ↓
useEffect #1: Load parent data for breadcrumb
  ↓
┌─────────────────────────────────────────────────────────┐
│ loadParentData():                                       │
│                                                          │
│ 1. const apiModule = api.projectApi                    │
│ 2. const response = await apiModule.get(parentId)       │
│    → API: GET /api/v1/project/84215ccb...              │
│ 3. setParentData(response.data)                         │
│    // Used for breadcrumb: "Project › Fall Campaign"  │
└─────────────────────────────────────────────────────────┘
  ↓
useEffect #2: Load child data (if not table view)
  ↓
If view === 'table':
  → Skip, FilteredDataTable handles its own data loading

If view === 'kanban' or 'grid':
  ↓
┌─────────────────────────────────────────────────────────┐
│ loadChildData():                                        │
│                                                          │
│ Option A: Use parent-specific endpoint                  │
│ ────────────────────────────────────────────────────   │
│ 1. const apiModule = api.projectApi                    │
│ 2. const methodName = 'getTasks' // get + Task + s     │
│ 3. if (apiModule.getTasks) {                            │
│      const response = await apiModule.getTasks(         │
│        parentId,                                         │
│        { page: 1, pageSize: 100 }                       │
│      )                                                   │
│      → API: GET /api/v1/project/84215ccb.../task       │
│    }                                                     │
│                                                          │
│ Option B: Fallback to generic endpoint                  │
│ ────────────────────────────────────────────────────   │
│ 1. const childApiModule = api.taskApi                  │
│ 2. const response = await childApiModule.list({         │
│      page: 1,                                            │
│      pageSize: 100,                                      │
│      parentId: '84215ccb...',                           │
│      parentType: 'project'                               │
│    })                                                    │
│    → API: GET /api/v1/task?parentId=84215ccb...&       │
│              parentType=project                          │
│                                                          │
│ 4. setData(response.data) // Child entities            │
└─────────────────────────────────────────────────────────┘
  ↓
Render content based on view mode
```

#### 2. **FilteredDataTable Integration (Table View)**

When `view === 'table'`, FilteredDataTable receives parent context:

```tsx
<FilteredDataTable
  entityType="task"           // What to show
  parentType="project"        // Filter by this parent type
  parentId="84215ccb..."      // Filter by this parent ID
  showActionButtons={false}   // Hide filters (parent-specific view)
  onRowClick={handleRowClick} // Navigate to /task/{taskId}
/>
```

FilteredDataTable internally:
```typescript
// Inside FilteredDataTable
useEffect(() => {
  const params = {
    page: currentPage,
    pageSize: itemsPerPage,
    sortBy: sortColumn,
    sortOrder: sortDirection,
    search: searchTerm,
    // PARENT FILTERING
    ...(parentId && { parentId }),
    ...(parentType && { parentType })
  };

  const apiModule = api.taskApi;
  const response = await apiModule.list(params);
  // API: GET /api/v1/task?page=1&pageSize=20&parentId=84215ccb...&parentType=project

  setRows(response.data);
}, [parentId, parentType, currentPage, sortColumn, ...]);
```

#### 3. **Create Button Click**
```
User clicks "Create Task" in EntityChildListPage
  ↓
handleCreateClick() fires
  ↓
navigate(`/project/${parentId}/task/new`)
  // Note: Scoped to this project
  ↓
Task creation form loads with:
  - Pre-filled project_id = parentId
  - Context: Creating task for "Fall 2024 Landscaping Campaign"
```

#### 4. **Row Click**
```
User clicks a task row
  ↓
handleRowClick(taskItem) fires
  ↓
navigate(`/task/${taskItem.id}`)
  // Navigates to task detail page (different parent context)
  ↓
EntityDetailPage loads for task entity
```

#### 5. **View Switching in Child List**
```
User clicks Grid icon in ViewSwitcher
  ↓
setView('grid')
  ↓
useViewMode() saves to localStorage as 'project_task_view: grid'
  // Note: Unique key per parent-child combination
  ↓
useEffect detects view change
  ↓
loadChildData() fetches tasks via API
  ↓
GridView renders with filtered tasks
```

### Parent Context vs Standalone

**Key Difference:**

| Aspect | EntityMainPage | EntityChildListPage |
|--------|----------------|---------------------|
| **Context** | Standalone | Within parent |
| **URL** | `/task` | `/project/123/task` |
| **Data** | All tasks | Tasks for project 123 |
| **Create** | `navigate('/task/new')` | `navigate('/project/123/task/new')` |
| **Layout** | Has `<Layout>` | NO `<Layout>` (nested) |
| **View Pref** | Saved as `task_view` | Saved as `project_task_view` |

---

## Component Interaction Flow

### DynamicChildEntityTabs Component

**File:** `apps/web/src/components/common/DynamicChildEntityTabs.tsx`

**Purpose:** Renders tab navigation with counts fetched from API

```tsx
<DynamicChildEntityTabs
  title="Fall 2024 Landscaping Campaign"
  parentType="project"
  parentId="84215ccb..."
  parentName="Fall 2024 Landscaping Campaign"
  tabs={[
    { id: 'overview', label: 'Overview', path: '/project/84215ccb...' },
    { id: 'task', label: 'Tasks', count: 5, path: '/project/84215ccb.../task' },
    { id: 'wiki', label: 'Wiki', count: 3, path: '/project/84215ccb.../wiki' },
    { id: 'artifact', label: 'Artifacts', count: 8, path: '/project/84215ccb.../artifact' },
    { id: 'form', label: 'Forms', count: 2, path: '/project/84215ccb.../form' }
  ]}
/>
```

**Rendering:**
```tsx
<div className="tabs-container">
  {/* Tab Navigation */}
  <nav className="tabs">
    {tabs.map(tab => {
      const isActive = currentPath === tab.path;
      return (
        <button
          onClick={() => navigate(tab.path)}
          className={isActive ? 'active' : ''}
        >
          <Icon />
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span className="count-badge">{tab.count}</span>
          )}
        </button>
      );
    })}
  </nav>
</div>
```

### useDynamicChildEntityTabs Hook

**Purpose:** Fetch tab counts from API

```typescript
export function useDynamicChildEntityTabs(parentType: string, parentId: string) {
  const [tabs, setTabs] = useState<HeaderTab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActionSummaries = async () => {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(
        `${API_BASE_URL}/api/v1/${parentType}/${parentId}/dynamic-child-entity-tabs`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // data.action_entities = [
        //   { actionEntity: 'task', label: 'Tasks', count: 5, canCreate: true },
        //   { actionEntity: 'wiki', label: 'Wiki', count: 3, canCreate: true },
        //   ...
        // ]

        const generatedTabs = data.action_entities.map(entity => ({
          id: entity.actionEntity,
          label: entity.label,
          count: entity.count,
          icon: getEntityIcon(entity.actionEntity),
          path: `/${parentType}/${parentId}/${entity.actionEntity}`,
          disabled: !entity.canCreate
        }));

        setTabs([
          { id: 'overview', label: 'Overview', path: `/${parentType}/${parentId}` },
          ...generatedTabs
        ]);
      } else {
        // Fallback to default tabs
        setTabs(getDefaultTabs(parentType, parentId));
      }
    };

    fetchActionSummaries();
  }, [parentType, parentId]);

  return { tabs, loading };
}
```

---

## API Integration Patterns

### API Module Structure

**File:** `apps/web/src/lib/api.ts` (assumed)

```typescript
// Generic API module for each entity
export const projectApi = {
  list: async (params) => {
    // GET /api/v1/project?page=1&pageSize=20&sortBy=name&...
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/api/v1/project?${queryString}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },

  get: async (id) => {
    // GET /api/v1/project/{id}
    const response = await fetch(`${API_BASE_URL}/api/v1/project/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },

  update: async (id, data) => {
    // PUT /api/v1/project/{id}
    const response = await fetch(`${API_BASE_URL}/api/v1/project/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  create: async (data) => {
    // POST /api/v1/project
    const response = await fetch(`${API_BASE_URL}/api/v1/project`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  delete: async (id) => {
    // DELETE /api/v1/project/{id}
    const response = await fetch(`${API_BASE_URL}/api/v1/project/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },

  // Child entity methods
  getTasks: async (projectId, params) => {
    // GET /api/v1/project/{projectId}/task
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/project/${projectId}/task?${queryString}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.json();
  },

  getWikis: async (projectId, params) => {
    // GET /api/v1/project/{projectId}/wiki
    // Similar to getTasks
  },

  getArtifacts: async (projectId, params) => {
    // GET /api/v1/project/{projectId}/artifact
  },

  getForms: async (projectId, params) => {
    // GET /api/v1/project/{projectId}/form
  }
};

export const taskApi = { /* Similar structure */ };
export const wikiApi = { /* Similar structure */ };
// ... etc for all entities
```

### API Endpoints Reference

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/api/v1/{entity}` | GET | List all entities | EntityMainPage (kanban/grid) |
| `/api/v1/{entity}?page=1&pageSize=20&parentId=...` | GET | List with filters | FilteredDataTable |
| `/api/v1/{entity}/{id}` | GET | Get single entity | EntityDetailPage |
| `/api/v1/{entity}/{id}` | PUT | Update entity | EntityDetailPage (save) |
| `/api/v1/{entity}` | POST | Create entity | Create forms |
| `/api/v1/{entity}/{id}` | DELETE | Delete entity | Bulk actions |
| `/api/v1/{parentType}/{parentId}/dynamic-child-entity-tabs` | GET | Get tab counts | useDynamicChildEntityTabs |
| `/api/v1/{parentType}/{parentId}/{childType}` | GET | Get child entities | EntityChildListPage |

### Response Formats

**List Response:**
```json
{
  "data": [
    { "id": "uuid", "name": "Project 1", ... },
    { "id": "uuid", "name": "Project 2", ... }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

**Single Entity Response:**
```json
{
  "id": "84215ccb-313d-48f8-9c37-4398f28c0b1f",
  "name": "Fall 2024 Landscaping Campaign",
  "code": "FLC-2024-001",
  "slug": "fall-landscaping-campaign-2024",
  "descr": "Seasonal landscaping campaign...",
  "tags": ["landscaping", "seasonal", "campaign"],
  "metadata": { "priority": "high", "complexity": "medium" },
  "project_stage": "Planning",
  "budget_allocated": 150000,
  "planned_start_date": "2024-09-01T00:00:00.000Z",
  "planned_end_date": "2024-11-30T00:00:00.000Z"
}
```

**Dynamic Tabs Response:**
```json
{
  "action_entities": [
    {
      "actionEntity": "task",
      "label": "Tasks",
      "count": 5,
      "canCreate": true,
      "canView": true
    },
    {
      "actionEntity": "wiki",
      "label": "Wiki",
      "count": 3,
      "canCreate": true,
      "canView": true
    },
    {
      "actionEntity": "artifact",
      "label": "Artifacts",
      "count": 8,
      "canCreate": true,
      "canView": true
    },
    {
      "actionEntity": "form",
      "label": "Forms",
      "count": 2,
      "canCreate": false,
      "canView": true
    }
  ]
}
```

---

## Routing Architecture

### Route Configuration

**File:** `apps/web/src/App.tsx`

```tsx
<Routes>
  {/* Login */}
  <Route path="/login" element={<LoginForm />} />

  {/* Entity Main Pages (List View) */}
  <Route path="/project" element={<EntityMainPage entityType="project" />} />
  <Route path="/task" element={<EntityMainPage entityType="task" />} />
  <Route path="/wiki" element={<EntityMainPage entityType="wiki" />} />
  <Route path="/artifact" element={<EntityMainPage entityType="artifact" />} />
  <Route path="/form" element={<EntityMainPage entityType="form" />} />
  <Route path="/biz" element={<EntityMainPage entityType="biz" />} />
  <Route path="/org" element={<EntityMainPage entityType="org" />} />
  <Route path="/employee" element={<EntityMainPage entityType="employee" />} />
  <Route path="/role" element={<EntityMainPage entityType="role" />} />
  <Route path="/client" element={<EntityMainPage entityType="client" />} />
  <Route path="/worksite" element={<EntityMainPage entityType="worksite" />} />
  <Route path="/position" element={<EntityMainPage entityType="position" />} />

  {/* Entity Detail Pages with Nested Routes */}

  {/* PROJECT */}
  <Route path="/project/:id" element={<EntityDetailPage entityType="project" />}>
    <Route path="task" element={<EntityChildListPage parentType="project" childType="task" />} />
    <Route path="wiki" element={<EntityChildListPage parentType="project" childType="wiki" />} />
    <Route path="artifact" element={<EntityChildListPage parentType="project" childType="artifact" />} />
    <Route path="form" element={<EntityChildListPage parentType="project" childType="form" />} />
  </Route>

  {/* BUSINESS */}
  <Route path="/biz/:id" element={<EntityDetailPage entityType="biz" />}>
    <Route path="project" element={<EntityChildListPage parentType="biz" childType="project" />} />
    <Route path="task" element={<EntityChildListPage parentType="biz" childType="task" />} />
    <Route path="wiki" element={<EntityChildListPage parentType="biz" childType="wiki" />} />
    <Route path="artifact" element={<EntityChildListPage parentType="biz" childType="artifact" />} />
    <Route path="form" element={<EntityChildListPage parentType="biz" childType="form" />} />
  </Route>

  {/* ORGANIZATION */}
  <Route path="/org/:id" element={<EntityDetailPage entityType="org" />}>
    <Route path="worksite" element={<EntityChildListPage parentType="org" childType="worksite" />} />
    <Route path="employee" element={<EntityChildListPage parentType="org" childType="employee" />} />
    <Route path="wiki" element={<EntityChildListPage parentType="org" childType="wiki" />} />
    <Route path="task" element={<EntityChildListPage parentType="org" childType="task" />} />
    <Route path="artifact" element={<EntityChildListPage parentType="org" childType="artifact" />} />
    <Route path="form" element={<EntityChildListPage parentType="org" childType="form" />} />
  </Route>

  {/* WORKSITE */}
  <Route path="/worksite/:id" element={<EntityDetailPage entityType="worksite" />}>
    <Route path="task" element={<EntityChildListPage parentType="worksite" childType="task" />} />
    <Route path="form" element={<EntityChildListPage parentType="worksite" childType="form" />} />
  </Route>

  {/* TASK */}
  <Route path="/task/:id" element={<EntityDetailPage entityType="task" />}>
    <Route path="form" element={<EntityChildListPage parentType="task" childType="form" />} />
    <Route path="artifact" element={<EntityChildListPage parentType="task" childType="artifact" />} />
  </Route>

  {/* Simple Detail Pages (no children) */}
  <Route path="/employee/:id" element={<EntityDetailPage entityType="employee" />} />
  <Route path="/role/:id" element={<EntityDetailPage entityType="role" />} />
  <Route path="/client/:id" element={<EntityDetailPage entityType="client" />} />
  <Route path="/position/:id" element={<EntityDetailPage entityType="position" />} />
  <Route path="/wiki/:id" element={<EntityDetailPage entityType="wiki" />} />
  <Route path="/artifact/:id" element={<EntityDetailPage entityType="artifact" />} />
  <Route path="/form/:id" element={<EntityDetailPage entityType="form" />} />
</Routes>
```

### Navigation Flow Examples

#### Example 1: Browse Projects → View Project → View Tasks

```
1. User clicks "Project" in sidebar
   URL: /project
   Component: EntityMainPage (entityType="project")
   Displays: Table/Kanban/Grid of all projects

2. User clicks "Fall 2024 Landscaping Campaign" row
   URL: /project/84215ccb-313d-48f8-9c37-4398f28c0b1f
   Component: EntityDetailPage (entityType="project")
   Displays: Project overview tab with all fields
   Tabs: [Overview, Tasks (5), Wiki (3), Artifacts (8), Forms (2)]

3. User clicks "Tasks (5)" tab
   URL: /project/84215ccb-313d-48f8-9c37-4398f28c0b1f/task
   Component: EntityDetailPage (still mounted)
              └─> EntityChildListPage (via <Outlet />)
                  (parentType="project", childType="task")
   Displays: Filtered table of 5 tasks for this project
   Tabs: [Overview, Tasks (5) ← ACTIVE, Wiki (3), Artifacts (8), Forms (2)]

4. User clicks a specific task row
   URL: /task/abc123-def456-ghi789
   Component: EntityDetailPage (entityType="task")
   Displays: Task overview tab
   Tabs: [Overview, Forms (2), Artifacts (1)]
```

#### Example 2: Create New Task for Project

```
1. User is viewing: /project/84215ccb.../task
   Component: EntityChildListPage

2. User clicks "Create Task" button
   URL: /project/84215ccb.../task/new
   Component: TaskCreateForm (with project context)
   Pre-filled: project_id = 84215ccb...

3. User fills form and saves
   API: POST /api/v1/task
   Body: { name: "New Task", project_id: "84215ccb...", ... }

4. Redirect to: /task/new-task-id-123
   Component: EntityDetailPage (entityType="task")
   Displays: Newly created task
```

---

## Data Flow Diagrams

### Complete User Journey: Project Detail Page

```
┌─────────────────────────────────────────────────────────────────┐
│ USER NAVIGATES TO: /project/84215ccb...                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ React Router                                                     │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ <Route path="/project/:id"                               │   │
│ │        element={<EntityDetailPage entityType="project"/>}│   │
│ └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ EntityDetailPage Component Mounts                               │
│                                                                  │
│ ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│ │ Extract URL params  │  │ Load configuration                │  │
│ │ id = '84215ccb...'  │  │ config = getEntityConfig('project')│ │
│ └─────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
           ┌──────────────────┴──────────────────┐
           ↓                                      ↓
┌────────────────────────────┐      ┌────────────────────────────┐
│ useEffect: loadData()      │      │ useDynamicChildEntityTabs  │
│                             │      │                             │
│ API Call:                  │      │ API Call:                  │
│ GET /api/v1/project/       │      │ GET /api/v1/project/       │
│     84215ccb...            │      │     84215ccb.../           │
│                             │      │     dynamic-child-entity-  │
│ Response:                  │      │     tabs                   │
│ {                           │      │                             │
│   id: '84215ccb...',       │      │ Response:                  │
│   name: 'Fall 2024...',    │      │ {                           │
│   code: 'FLC-2024-001',    │      │   "action_entities": [     │
│   slug: 'fall-...',        │      │     {                       │
│   descr: '...',            │      │       "actionEntity": "task"│
│   project_stage: 'Planning'│      │       "label": "Tasks",    │
│   budget_allocated: 150000,│      │       "count": 5           │
│   planned_start_date: ..., │      │     },                      │
│   tags: [...],             │      │     { ... wiki ... },       │
│   metadata: {...}          │      │     { ... artifact ... },  │
│ }                           │      │     { ... form ... }       │
│                             │      │   ]                         │
│ setData(response)          │      │ }                           │
│ setEditedData(response)    │      │                             │
└────────────────────────────┘      │ Transform to HeaderTab[]   │
                                     │ setTabs([                  │
                                     │   {id: 'overview', ...},   │
                                     │   {id: 'task', count: 5,...}│
                                     │   ...                       │
                                     │ ])                          │
                                     └────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Page Renders                                                     │
│                                                                  │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ Layout (Sidebar + Main Content)                           ┃  │
│ ┃ ┌──────────────────────────────────────────────────────┐  ┃  │
│ ┃ │ Header                                                │  ┃  │
│ ┃ │ ← Back  Fall 2024 Landscaping Campaign    [Edit]     │  ┃  │
│ ┃ │         Project · 84215ccb...                         │  ┃  │
│ ┃ └──────────────────────────────────────────────────────┘  ┃  │
│ ┃                                                             ┃  │
│ ┃ ┌──────────────────────────────────────────────────────┐  ┃  │
│ ┃ │ DynamicChildEntityTabs                                │  ┃  │
│ ┃ │ ┌──────┬─────────┬──────┬───────────┬────────┐       │  ┃  │
│ ┃ │ │ Overview│Tasks (5)│Wiki (3)│Artifacts(8)│Forms(2)│  │  ┃  │
│ ┃ │ └──────┴─────────┴──────┴───────────┴────────┘       │  ┃  │
│ ┃ └──────────────────────────────────────────────────────┘  ┃  │
│ ┃                                                             ┃  │
│ ┃ ┌──────────────────────────────────────────────────────┐  ┃  │
│ ┃ │ Content Area (isOverviewTab = true)                  │  ┃  │
│ ┃ │                                                        │  ┃  │
│ ┃ │ Project Information                                   │  ┃  │
│ ┃ │ ┌─────────────────┬──────────────────┐              │  ┃  │
│ ┃ │ │ Project Name    │ Project Code     │              │  ┃  │
│ ┃ │ │ Fall 2024...    │ FLC-2024-001     │              │  ┃  │
│ ┃ │ ├─────────────────┼──────────────────┤              │  ┃  │
│ ┃ │ │ Slug            │ Description      │              │  ┃  │
│ ┃ │ │ fall-land...    │ Seasonal...      │              │  ┃  │
│ ┃ │ ├─────────────────┼──────────────────┤              │  ┃  │
│ ┃ │ │ Stage           │ Budget           │              │  ┃  │
│ ┃ │ │ Planning        │ $150,000         │              │  ┃  │
│ ┃ │ ├─────────────────┼──────────────────┤              │  ┃  │
│ ┃ │ │ Start Date      │ End Date         │              │  ┃  │
│ ┃ │ │ 9/1/2024        │ 11/30/2024       │              │  ┃  │
│ ┃ │ └─────────────────┴──────────────────┘              │  ┃  │
│ ┃ │                                                        │  ┃  │
│ ┃ │ Tags: [landscaping] [seasonal] [campaign] ...        │  ┃  │
│ ┃ │                                                        │  ┃  │
│ ┃ │ Metadata: { "priority": "high", "complexity": ... }  │  ┃  │
│ ┃ └──────────────────────────────────────────────────────┘  ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
└─────────────────────────────────────────────────────────────────┘
```

### Tab Click Flow: Overview → Tasks

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS: Tasks (5) tab                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DynamicChildEntityTabs.handleTabClick()                         │
│                                                                  │
│ navigate('/project/84215ccb.../task')                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ URL Changes (EntityDetailPage STAYS MOUNTED)                    │
│                                                                  │
│ location.pathname = '/project/84215ccb.../task'                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ EntityDetailPage Re-analyzes URL                                │
│                                                                  │
│ const pathParts = [' ', 'project', '84215ccb...', 'task']      │
│ const currentChildEntity = 'task'                               │
│ const isOverviewTab = false  ← CHANGED                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Conditional Rendering Switches                                  │
│                                                                  │
│ {isOverviewTab ? (                                              │
│   <EntityDetails /> ← NOT RENDERED                              │
│ ) : (                                                            │
│   <Outlet /> ← NOW RENDERED                                     │
│ )}                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ React Router Matches Nested Route                               │
│                                                                  │
│ <Route path="task"                                              │
│        element={<EntityChildListPage                            │
│                   parentType="project"                          │
│                   childType="task" />} />                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ EntityChildListPage Mounts                                      │
│                                                                  │
│ ┌────────────────────┐  ┌────────────────────────────────────┐ │
│ │ Extract URL params │  │ Load configurations                 │ │
│ │ parentId =         │  │ config = getEntityConfig('task')   │ │
│ │   '84215ccb...'    │  │ parentConfig =                     │ │
│ │                     │  │   getEntityConfig('project')       │ │
│ └────────────────────┘  └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
           ┌──────────────────┴──────────────────┐
           ↓                                      ↓
┌────────────────────────────┐      ┌────────────────────────────┐
│ useEffect:                 │      │ Render Content              │
│ loadParentData()           │      │                             │
│                             │      │ view === 'table' ?         │
│ API: GET /api/v1/project/  │      │                             │
│          84215ccb...       │      │ <FilteredDataTable          │
│                             │      │   entityType="task"        │
│ setParentData({            │      │   parentType="project"     │
│   name: 'Fall 2024...'     │      │   parentId="84215ccb..."   │
│ })                          │      │ />                          │
│                             │      │                             │
│ (Used for breadcrumb)      │      │ FilteredDataTable fetches: │
└────────────────────────────┘      │ GET /api/v1/task?          │
                                     │     parentId=84215ccb...&  │
                                     │     parentType=project     │
                                     │                             │
                                     │ Displays: 5 tasks filtered │
                                     │           for this project │
                                     └────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Page Now Shows                                                   │
│                                                                  │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ Layout (Sidebar + Main Content)                           ┃  │
│ ┃ ┌──────────────────────────────────────────────────────┐  ┃  │
│ ┃ │ Header (SAME)                                         │  ┃  │
│ ┃ │ ← Back  Fall 2024 Landscaping Campaign    [Edit]     │  ┃  │
│ ┃ └──────────────────────────────────────────────────────┘  ┃  │
│ ┃                                                             ┃  │
│ ┃ ┌──────────────────────────────────────────────────────┐  ┃  │
│ ┃ │ DynamicChildEntityTabs (SAME)                         │  ┃  │
│ ┃ │ ┌────────┬─────────┬────────┬─────────┬────────┐     │  ┃  │
│ ┃ │ │Overview│Tasks (5)│Wiki (3)│Artifacts│Forms(2)│     │  ┃  │
│ ┃ │ │         │ ACTIVE   │         │  (8)     │         │     │  ┃  │
│ ┃ │ └────────┴─────────┴────────┴─────────┴────────┘     │  ┃  │
│ ┃ └──────────────────────────────────────────────────────┘  ┃  │
│ ┃                                                             ┃  │
│ ┃ ┌──────────────────────────────────────────────────────┐  ┃  │
│ ┃ │ Content Area (NOW: EntityChildListPage)              │  ┃  │
│ ┃ │                                                        │  ┃  │
│ ┃ │ Tasks    [Table] [Kanban] [Grid]  [Create Task]      │  ┃  │
│ ┃ │                                                        │  ┃  │
│ ┃ │ ┌──────────────────────────────────────────────────┐ │  ┃  │
│ ┃ │ │ FilteredDataTable                                 │ │  ┃  │
│ ┃ │ │                                                    │ │  ┃  │
│ ┃ │ │ Task Name          │ Stage      │ Priority │ Due  │ │  ┃  │
│ ┃ │ │ ───────────────────┼────────────┼──────────┼───── │ │  ┃  │
│ ┃ │ │ Site Preparation   │ To Do      │ High     │ 9/5  │ │  ┃  │
│ ┃ │ │ Equipment Setup    │ In Progress│ Medium   │ 9/8  │ │  ┃  │
│ ┃ │ │ Soil Testing       │ To Do      │ High     │ 9/10 │ │  ┃  │
│ ┃ │ │ Planting Schedule  │ Backlog    │ Low      │ 9/15 │ │  ┃  │
│ ┃ │ │ Quality Inspection │ To Do      │ High     │ 9/30 │ │  ┃  │
│ ┃ │ └──────────────────────────────────────────────────┘ │  ┃  │
│ ┃ └──────────────────────────────────────────────────────┘  ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Key Architectural Decisions

1. **3-Page Universal System**: One codebase serves all 12 entity types
2. **Configuration-Driven**: entityConfig.ts controls all entity-specific behavior
3. **Nested Routing**: Child entity lists render inside parent detail page
4. **URL-Based State**: Tabs use navigation, not React state
5. **API Module Pattern**: Consistent API interface for all entities
6. **Dynamic Tab Loading**: Tab counts fetched from backend API
7. **Layout Nesting**: EntityMainPage and EntityDetailPage have Layout, EntityChildListPage doesn't
8. **Field Rendering**: Universal renderField() handles all field types
9. **View Persistence**: localStorage remembers user's preferred view mode
10. **Parent Context**: FilteredDataTable filters by parent when provided

### File Responsibility Matrix

| File | Responsibility | Has Layout? | API Calls |
|------|----------------|-------------|-----------|
| EntityMainPage.tsx | List all entities | ✅ Yes | Kanban/Grid only |
| EntityDetailPage.tsx | Show entity details + tabs | ✅ Yes | Entity detail, Tab counts |
| EntityChildListPage.tsx | List filtered children | ❌ No (nested) | Parent info, Child list |
| FilteredDataTable.tsx | Table with pagination/filters | N/A (component) | Entity list with filters |
| DynamicChildEntityTabs.tsx | Tab navigation | N/A (component) | None (uses hook) |
| useDynamicChildEntityTabs.ts | Fetch tab counts | N/A (hook) | Tab counts API |
| entityConfig.ts | Entity definitions | N/A (config) | None |

This architecture enables:
- ✅ Code reuse across all entity types
- ✅ Consistent UX throughout the application
- ✅ Easy addition of new entity types
- ✅ Maintainable and scalable codebase
- ✅ Type-safe configuration system
- ✅ Flexible view modes (table, kanban, grid)
- ✅ Nested entity relationships
- ✅ RBAC-aware tab visibility
