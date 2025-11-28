# PMO Web Application

> **React 19 Enterprise Frontend with Universal Entity Architecture**

## Overview

The PMO Web Application is a modern, configuration-driven React frontend that provides a complete user interface for the Project Management Office platform. Built on React 19 with TypeScript, Vite, and Tailwind CSS, it features universal entity components, dynamic routing, centralized configuration, and RBAC integration.

**Key Achievement:** Reduced 72+ entity-specific page components to just 4 universal components through metadata-driven architecture.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

**Access Points:**
- Web Application: http://localhost:5173
- API Backend: http://localhost:4000

## Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI library | 19.x |
| **TypeScript** | Type safety | 5.x |
| **Vite** | Build tool | 5.x |
| **Tailwind CSS** | Utility-first CSS | 3.x |
| **React Router** | Client-side routing | 6.x |
| **Lucide React** | Icon library | Latest |
| **TanStack Table** | Data tables | 8.x |

## Architecture Philosophy

### The Universal Component Pattern

Instead of creating separate page components for each entity type (24+ entities × 3 pages = 72+ files), the application uses **3 universal page components** driven by centralized configuration.

**Before (Traditional Approach):**
```
pages/
├── project/ProjectListPage.tsx          # 280 lines
├── project/ProjectDetailPage.tsx        # 350 lines
├── project/ProjectCreatePage.tsx        # 200 lines
├── task/TaskListPage.tsx                # 280 lines
├── task/TaskDetailPage.tsx              # 350 lines
├── task/TaskCreatePage.tsx              # 200 lines
... 72+ files total
```

**After (Universal Architecture):**
```
pages/shared/
├── EntityListOfInstancesPage.tsx                   # 280 lines - works for ALL entities
├── EntitySpecificInstancePage.tsx                 # 527 lines - works for ALL entities
├── EntityCreatePage.tsx                 # 150 lines - works for ALL entities
└── EntityChildListPage.tsx              # 281 lines - works for ALL child tabs
```

**Result:** ~94% code reduction, single source of truth, consistent UX

### Core Architecture Principles

1. **Configuration-Driven** - `entityConfig.ts` defines all entity behavior
2. **Type-Safe API Factory** - `api-factory.ts` eliminates unsafe dynamic API calls
3. **Universal Components** - One component works for all 24+ entity types
4. **Database-Driven Metadata** - Icons, labels, child relationships from `d_entity` table
5. **Settings-Driven Dropdowns** - Dynamic options loaded from 16 settings tables
6. **RBAC at API Level** - Frontend displays all data, API enforces permissions

## Project Structure

```
apps/web/src/
├── pages/
│   ├── shared/                          # 4 Universal Components
│   │   ├── EntityListOfInstancesPage.tsx           # List page (table/kanban/grid views)
│   │   ├── EntitySpecificInstancePage.tsx         # Detail page with tabs
│   │   ├── EntityCreatePage.tsx         # Create page with dynamic form
│   │   └── EntityChildListPage.tsx      # Child entity list (filtered)
│   ├── form/                            # Form-specific pages
│   │   ├── FormBuilderPage.tsx          # Form schema builder
│   │   ├── FormEditPage.tsx             # Form instance editor
│   │   ├── FormViewPage.tsx             # Form submission viewer
│   │   └── PublicFormPage.tsx           # Public form submission
│   ├── wiki/                            # Wiki-specific pages
│   │   ├── WikiEditorPage.tsx           # Rich text wiki editor
│   │   └── WikiViewPage.tsx             # Wiki page viewer
│   ├── setting/                         # Settings management
│   │   ├── SettingsPage.tsx             # Universal settings page (1 component for 16 settings!)
│   │   └── DataLabelPage.tsx            # Data label management
│   ├── labels/                          # Label management
│   │   └── LabelsPage.tsx               # JSONB label editor
│   ├── security/                        # Security pages
│   │   └── SecurityPage.tsx             # RBAC management
│   ├── profile/                         # User profile
│   │   └── ProfilePage.tsx              # User profile settings
│   ├── billing/                         # Billing (future)
│   │   └── BillingPage.tsx              # Subscription management
│   ├── client/                          # Client-specific
│   │   └── client.tsx                   # Client page
│   └── LinkagePage.tsx                  # Entity relationship viewer
│
├── components/
│   ├── shared/
│   │   ├── layout/
│   │   │   └── Layout.tsx               # Main app layout with sidebar
│   │   ├── entity/
│   │   │   ├── DynamicChildEntityTabs.tsx  # Dynamic tab system
│   │   │   ├── EntityInstanceFormContainer.tsx     # Form rendering
│   │   │   └── TaskDataContainer.tsx       # Task-specific container
│   │   ├── data-table/
│   │   │   ├── DataTable.tsx            # Base table with sorting/filtering
│   │   │   ├── FilteredDataTable.tsx    # Entity-aware table
│   │   │   └── EntityAssignmentDataTable.tsx  # Assignment table
│   │   ├── ui/
│   │   │   ├── Button.tsx               # Button primitives
│   │   │   ├── GridView.tsx             # Card grid layout
│   │   │   └── TreeView.tsx             # Hierarchical tree
│   │   ├── ActionButtons.tsx            # Action button components
│   │   ├── InlineEditField.tsx          # Click-to-edit fields
│   │   ├── GlobalSearch.tsx             # Global search
│   │   └── StatsGrid.tsx                # Metrics cards
│   ├── form/
│   │   ├── FormBuilder.tsx              # Drag-drop form builder
│   │   ├── FormPreview.tsx              # Form preview
│   │   └── InteractiveForm.tsx          # Form renderer
│   ├── wiki/
│   │   ├── BlockEditor.tsx              # Block-based editor
│   │   └── WikiContentRenderer.tsx      # Wiki markdown renderer
│   ├── editor/
│   │   ├── ModularEditor.tsx            # Rich text editor
│   │   └── CodeBlock.tsx                # Code block component
│   └── auth/
│       └── LoginForm.tsx                # Authentication form
│
├── lib/
│   ├── entityConfig.ts                  # **1,600+ lines - Single source of truth**
│   ├── api-factory.ts                   # Type-safe API registry
│   ├── api.ts                           # API client implementations
│   ├── entityIcons.ts                   # Centralized icon system
│   ├── settingsLoader.ts                # Dynamic settings loader
│   └── hooks/
│       └── useViewMode.ts               # View mode persistence
│
├── App.tsx                              # Route definitions
└── main.tsx                             # React entry point
```

## The Central Configuration System

### 1. Entity Configuration (`entityConfig.ts`)

**Location:** `apps/web/src/lib/entityConfig.ts` (1,600+ lines)

**Purpose:** Single source of truth for ALL entity behavior across the application.

**What it defines:**
- **Columns** - Table column definitions with custom render functions
- **Fields** - Form field definitions with validation rules
- **View Modes** - Supported views (table, kanban, grid)
- **Child Entities** - Parent-child relationships for tabs
- **Kanban Config** - Kanban board settings (grouping, card fields)
- **Grid Config** - Grid view settings (card fields, images)
- **API Endpoints** - Backend API routes
- **Settings Integration** - Which fields load from settings tables

**Example Configuration:**

```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  project: {
    name: 'project',
    displayName: 'Project',
    pluralName: 'Projects',
    apiEndpoint: '/api/v1/project',

    // Table columns
    columns: [
      {
        key: 'name',
        title: 'Project Name',
        sortable: true,
        filterable: true,
        render: (value) => value
      },
      {
        key: 'project_stage',
        title: 'Stage',
        loadOptionsFromSettings: true,  // Auto-loads from app.datalabel table
        inlineEditable: true,            // Enable inline editing
        render: (value, record) => renderBadge(record.project_stage_name, colorMap)
      }
    ],

    // Form fields
    fields: [
      { key: 'name', label: 'Project Name', type: 'text', required: true },
      { key: 'project_stage', label: 'Stage', type: 'select', loadOptionsFromSettings: true },
      { key: 'budget_allocated', label: 'Budget', type: 'number' }
    ],

    // View modes
    supportedViews: ['table', 'kanban'],
    defaultView: 'table',

    // Child entities (creates tabs on detail page)
    childEntities: ['task', 'wiki', 'artifact', 'form']
  },

  // ... 23 more entity configurations
};
```

### 2. API Factory (`api-factory.ts`)

**Location:** `apps/web/src/lib/api-factory.ts`

**Problem Solved:** Eliminated unsafe `(api as any)[entityType + 'Api']` pattern

**Pattern:**

```typescript
// BEFORE (Type-Unsafe):
const apiModule = (api as any)[`${entityType}Api`];  // No type safety
const response = await apiModule.list({ page: 1 });

// AFTER (Type-Safe):
const api = APIFactory.getAPI(entityType);           // Compile-time checking
const response = await api.list({ page: 1 });
```

**Registration:**

```typescript
// apps/web/src/lib/api.ts
import { APIFactory } from './api-factory';

// Register all entity APIs
APIFactory.register('project', projectApi);
APIFactory.register('task', taskApi);
APIFactory.register('client', clientApi);
// ... 21 total entities
```

**Benefits:**
- Zero unsafe API calls
- Full IDE autocomplete
- Runtime validation
- Clear error messages

### 3. Entity Icons (`entityIcons.ts`)

**Location:** `apps/web/src/lib/entityIcons.ts`

**Purpose:** Centralized icon management for consistency across sidebar, settings, tabs, etc.

```typescript
import { Building2, FolderOpen, CheckSquare, Users } from 'lucide-react';

export const ENTITY_ICONS: Record<string, LucideIcon> = {
  business: Building2,
  project: FolderOpen,
  task: CheckSquare,
  client: Users,
  employee: Users,
  // ... 20+ entity types
};

export function getEntityIcon(entityType: string): LucideIcon {
  return ENTITY_ICONS[entityType] || FileText;
}
```

### 4. Settings Loader (`settingsLoader.ts`)

**Location:** `apps/web/src/lib/settingsLoader.ts`

**Purpose:** Dynamically load dropdown options from 16 settings tables

**How it works:**

```typescript
// 1. Field marked with loadOptionsFromSettings
{
  key: 'project_stage',
  type: 'select',
  loadOptionsFromSettings: true  // Triggers settings loader
}

// 2. Settings loader maps field to category
'project_stage' → 'projectStage' → '/api/v1/datalabel?name=projectStage'

// 3. API returns setting data
[
  { level_id: 0, level_name: 'Initiation', color_code: '#3B82F6' },
  { level_id: 1, level_name: 'Planning', color_code: '#10B981' },
  ...
]

// 4. Transformed to dropdown options
[
  { value: 0, label: 'Initiation' },
  { value: 1, label: 'Planning' },
  ...
]

// 5. Cached for 5 minutes
```

**16 Settings Categories:**
- `projectStage`, `projectStatus`
- `taskStage`, `taskPriority`, `taskUpdateType`
- `businessLevel`, `officeLevel`, `positionLevel`, `clientLevel`
- `customerTier`, `opportunityFunnelLevel`
- `industrySector`, `acquisitionChannel`, `clientStatus`
- `formSubmissionStatus`, `formApprovalStatus`, `wikiPublicationStatus`

## Universal Page Components

### 1. EntityListOfInstancesPage (List View)

**File:** `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` (280 lines)

**Purpose:** Universal list page for ALL entities

**Features:**
- Multi-view support (table, kanban, grid)
- Dynamic header with entity icon
- Create button
- View mode persistence
- Search and filtering

**Routing:**

```typescript
// App.tsx - Same component, different entity types
<Route path="/project" element={<EntityListOfInstancesPage entityType="project" />} />
<Route path="/task" element={<EntityListOfInstancesPage entityType="task" />} />
<Route path="/client" element={<EntityListOfInstancesPage entityType="client" />} />
// ... 24+ entities, same component!
```

**Data Flow:**

```typescript
export function EntityListOfInstancesPage({ entityType }: { entityType: string }) {
  const config = getEntityConfig(entityType);  // Get configuration
  const [view, setView] = useViewMode(entityType);  // Persist view preference

  const loadData = async () => {
    const api = APIFactory.getAPI(entityType);  // Type-safe API call
    const response = await api.list({ page: 1, pageSize: 100 });
    setData(response.data || []);
  };

  return (
    <div>
      {/* Dynamic header */}
      <EntityIcon className="h-5 w-5" />
      <h1>{config.pluralName}</h1>

      {/* View mode switcher */}
      {config.supportedViews.length > 1 && <ViewModeSwitcher />}

      {/* Render based on view mode */}
      {view === 'table' && <FilteredDataTable entityType={entityType} />}
      {view === 'kanban' && <KanbanBoard config={config.kanban} />}
      {view === 'grid' && <GridView items={data} config={config.grid} />}
    </div>
  );
}
```

### 2. EntitySpecificInstancePage (Detail View)

**File:** `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx` (527 lines)

**Purpose:** Universal detail page with dynamic tabs

**Features:**
- Overview tab with editable fields
- Dynamic child entity tabs (from API)
- Inline editing
- Special renderers (wiki, form)
- Nested routing for child tabs

**Routing:**

```typescript
<Route path="/project/:id" element={<EntitySpecificInstancePage entityType="project" />}>
  <Route path="task" element={<EntityChildListPage childType="task" />} />
  <Route path="wiki" element={<EntityChildListPage childType="wiki" />} />
  <Route path="artifact" element={<EntityChildListPage childType="artifact" />} />
</Route>
```

**Data Flow:**

```typescript
export function EntitySpecificInstancePage({ entityType }: { entityType: string }) {
  const { id } = useParams();
  const config = getEntityConfig(entityType);

  // Type-safe API call
  const loadData = async () => {
    const api = APIFactory.getAPI(entityType);
    const response = await api.get(id);
    setData(response.data);
  };

  // Dynamic tabs from API
  const { tabs } = useDynamicChildEntityTabs(entityType, id);
  // Returns: [
  //   { id: 'overview', label: 'Overview', ... },
  //   { id: 'task', label: 'Tasks (12)', count: 12, ... },
  //   { id: 'wiki', label: 'Wiki (3)', count: 3, ... }
  // ]

  return (
    <div>
      <DynamicChildEntityTabs tabs={tabs} />

      {isOverviewTab ? (
        <EntityInstanceFormContainer fields={config.fields} data={data} />
      ) : (
        <Outlet />  {/* Renders EntityChildListPage */}
      )}
    </div>
  );
}
```

### 3. EntityChildListPage (Child Entity Tab)

**File:** `apps/web/src/pages/shared/EntityChildListPage.tsx` (281 lines)

**Purpose:** Display child entities in parent detail page tabs

**Example:** Tasks tab on project detail page

**Data Flow:**

```typescript
export function EntityChildListPage({
  parentCode,  // "project"
  childType    // "task"
}: EntityChildListPageProps) {
  const { id: parentId } = useParams();  // Inherited from parent route
  const config = getEntityConfig(childType);

  const loadData = async () => {
    const api = APIFactory.getAPI(parentCode);  // projectApi
    const response = await api.getTasks(parentId);  // GET /api/v1/project/:id/task
    setData(response.data || []);
  };

  return (
    <FilteredDataTable
      entityType={childType}
      parentCode={parentCode}
      parentId={parentId}
      onRowClick={(item) => navigate(`/${childType}/${item.id}`)}
    />
  );
}
```

### 4. EntityCreatePage (Create Page)

**File:** `apps/web/src/pages/shared/EntityCreatePage.tsx` (150 lines)

**Purpose:** Universal create page with dynamic form

**Data Flow:**

```typescript
export function EntityCreatePage({ entityType }: { entityType: string }) {
  const config = getEntityConfig(entityType);

  const handleSubmit = async (formData: any) => {
    const api = APIFactory.getAPI(entityType);
    await api.create(formData);  // POST /api/v1/{entity}
    navigate(`/${entityType}`);
  };

  return (
    <Form fields={config.fields} onSubmit={handleSubmit} />
  );
}
```

## Routing Architecture

### Auto-Generated Routes

**File:** `apps/web/src/App.tsx`

Routes are generated programmatically from `entityConfig`:

```typescript
const coreEntities = ['project', 'task', 'biz', 'office', 'employee', 'client', ...];

const generateEntityRoutes = () => {
  return coreEntities.map(entityType => {
    const config = entityConfigs[entityType];
    return (
      <Fragment key={entityType}>
        {/* List route */}
        <Route path={`/${entityType}`}
               element={<EntityListOfInstancesPage entityType={entityType} />} />

        {/* Create route */}
        <Route path={`/${entityType}/new`}
               element={<EntityCreatePage entityType={entityType} />} />

        {/* Detail + child routes */}
        <Route path={`/${entityType}/:id`}
               element={<EntitySpecificInstancePage entityType={entityType} />}>
          {config.childEntities?.map(childType => (
            <Route key={childType}
                   path={childType}
                   element={<EntityChildListPage childType={childType} />} />
          ))}
        </Route>
      </Fragment>
    );
  });
};

<Routes>
  {generateEntityRoutes()}  {/* Generates 30+ routes from 10 entities */}
</Routes>
```

**Benefits:**
- Single source of truth
- Impossible to have inconsistent routes
- Add new entity = add 1 line to array
- Zero duplication

### URL Structure

```
/project                           → EntityListOfInstancesPage (project list)
/project/new                       → EntityCreatePage (create project)
/project/:id                       → EntitySpecificInstancePage (project detail)
/project/:id/task                  → EntityChildListPage (project tasks)
/project/:id/wiki                  → EntityChildListPage (project wiki)

/task                              → EntityListOfInstancesPage (task list)
/task/:id                          → EntitySpecificInstancePage (task detail)
/task/:id/form                     → EntityChildListPage (task forms)
```

## Component Architecture

### Data Table Components

**Hierarchy:**

```
DataTable.tsx (base)
└── FilteredDataTable.tsx (entity-aware)
    └── EntityAssignmentDataTable.tsx (specialized)
```

**DataTable.tsx** - Base table with sorting, filtering, pagination
- Generic reusable table
- No entity awareness
- Props: `columns`, `data`, `onRowClick`

**FilteredDataTable.tsx** - Entity-aware table
- Loads config from `entityConfig.ts`
- Type-safe API calls via `APIFactory`
- Inline editing support
- Action buttons (Create, Bulk Delete, Bulk Share)

```typescript
<FilteredDataTable
  entityType="project"
  showActionButtons={true}
  inlineEditable={false}
  onRowClick={(item) => navigate(`/project/${item.id}`)}
/>
```

### Dynamic Child Entity Tabs

**Component:** `DynamicChildEntityTabs.tsx`

**Purpose:** Generate tabs from API data

**API Call:**

```typescript
GET /api/v1/project/:id/child-tabs

Response:
{
  "tabs": [
    { "entity": "task", "ui_label": "Tasks", "ui_icon": "CheckSquare", "count": 12, "order": 1 },
    { "entity": "wiki", "ui_label": "Wiki", "ui_icon": "BookOpen", "count": 3, "order": 2 }
  ]
}
```

**Rendering:**

```typescript
export function DynamicChildEntityTabs({ parentCode, parentId }: Props) {
  const { tabs } = useDynamicChildEntityTabs(parentCode, parentId);

  return (
    <div className="flex gap-2">
      {tabs.map(tab => (
        <Link
          key={tab.entity}
          to={`/${parentCode}/${parentId}/${tab.entity}`}
          className={isActive ? 'active' : ''}
        >
          <Icon name={tab.ui_icon} />
          {tab.ui_label} ({tab.count})
        </Link>
      ))}
    </div>
  );
}
```

## Settings Page Architecture

**File:** `apps/web/src/pages/setting/SettingsPage.tsx` (92 lines)

**Achievement:** 1 component handles ALL 16 settings tables

**Before:** Would require 16 separate pages
**After:** 1 universal page with tab switcher

**How it works:**

```typescript
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingTab>('projectStage');

  const tabs = [
    { id: 'projectStage', label: 'Project Stage', icon: KanbanSquare },
    { id: 'taskStage', label: 'Task Stage', icon: CheckSquare },
    { id: 'customerTier', label: 'Customer Tier', icon: Users },
    // ... 13 more settings
  ];

  return (
    <div>
      {/* Tab navigation */}
      {tabs.map(tab => (
        <button onClick={() => setActiveTab(tab.id)}>
          <Icon /> {tab.label}
        </button>
      ))}

      {/* Universal data table - entityType changes based on tab */}
      <FilteredDataTable
        entityType={activeTab}  // Dynamic!
        inlineEditable={true}
        showEditIcon={true}
        showDeleteIcon={false}
      />
    </div>
  );
}
```

**Result:**
- 16 settings × 300 lines = 4,800 lines saved
- Add new setting = add 1 line to tabs array
- Consistent UX across all settings

## Styling & Design System

### Tailwind CSS

**Configuration:** `apps/web/tailwind.config.js`

**Custom Theme:**
- Extended color palette for badges
- Custom spacing for entity cards
- Responsive breakpoints for data tables

### Component Standards

**Icons:**
- Size: `h-5 w-5` for headers, `h-4 w-4` for inline
- Color: `text-gray-600` neutral, `text-blue-600` active
- Stroke: `stroke-[1.5]` consistent weight

**Badges:**
```typescript
<span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
  Active
</span>
```

**Buttons:**
- Primary: `bg-blue-600 hover:bg-blue-700 text-white`
- Secondary: `border border-gray-300 hover:bg-gray-50 text-gray-700`
- Danger: `bg-red-600 hover:bg-red-700 text-white`

## State Management

### React Hooks

- `useState` - Component-local state
- `useEffect` - Data fetching, subscriptions
- `useParams` - URL parameters
- `useNavigate` - Programmatic navigation
- `useMemo` - Expensive computations

### Custom Hooks

**useViewMode** - Persist view preference

```typescript
const [view, setView] = useViewMode('project');
// Reads from localStorage: 'viewMode_project'
// Returns: 'table' | 'kanban' | 'grid'
```

**useDynamicChildEntityTabs** - Fetch child tabs

```typescript
const { tabs, loading } = useDynamicChildEntityTabs('project', projectId);
```

## Authentication

### JWT Authentication

1. User logs in via `LoginForm.tsx`
2. JWT token stored in localStorage
3. `api.ts` includes token in all requests: `Authorization: Bearer <token>`
4. Invalid token → redirect to login

### No Frontend RBAC

- Frontend displays all data provided by API
- API enforces all RBAC permissions
- No permission checks in React components

## Performance Optimizations

### Code Splitting

```typescript
// Lazy load heavy components
const FormBuilderPage = lazy(() => import('./pages/form/FormBuilderPage'));
const WikiEditorPage = lazy(() => import('./pages/wiki/WikiEditorPage'));
```

### Memoization

```typescript
// Expensive column renders
const columns = useMemo(() => config.columns.map(...), [config]);
```

### Virtual Scrolling

- Large data tables use TanStack Table with virtualization
- Only renders visible rows

## Adding a New Entity

To add a new entity to the application:

1. **Add configuration** to `entityConfig.ts`:
   ```typescript
   vendor: {
     name: 'vendor',
     displayName: 'Vendor',
     pluralName: 'Vendors',
     apiEndpoint: '/api/v1/vendor',
     columns: [...],
     fields: [...],
     supportedViews: ['table', 'grid'],
     childEntities: []
   }
   ```

2. **Register API** in `api-factory.ts`:
   ```typescript
   APIFactory.register('vendor', vendorApi);
   ```

3. **Add route** to `App.tsx`:
   ```typescript
   const coreEntities = [...existing, 'vendor'];
   ```

4. **Add icon** to `entityIcons.ts`:
   ```typescript
   export const ENTITY_ICONS = {
     ...existing,
     vendor: Truck  // Lucide icon
   };
   ```

**That's it!** The universal components handle everything else automatically.

## Testing

### Test User

**Email:** `james.miller@huronhome.ca`
**Password:** `password123`

### Development Testing

```bash
# Start both API and web servers
cd /home/rabin/projects/pmo
./tools/start-all.sh
```

### Browser Testing

1. Open http://localhost:5173
2. Login with test credentials
3. Navigate through entities
4. Test CRUD operations
5. Check browser console for errors

## Build & Deployment

### Development Build

```bash
pnpm dev
```

### Production Build

```bash
pnpm build
# Output: apps/web/dist/
```

### Environment Variables

**File:** `apps/web/.env`

```bash
VITE_API_URL=http://localhost:4000
VITE_APP_NAME=PMO Platform
VITE_APP_VERSION=1.0.0
```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY apps/web/dist ./dist
RUN npm install -g serve
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
```

## Troubleshooting

### API Connection Issues

```typescript
// Check API_URL in api.ts
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
```

### Settings Not Loading

```typescript
// Clear settings cache
import { clearSettingsCache } from '@/lib/settingsLoader';
clearSettingsCache();  // Clears all cached settings
```

### TypeScript Errors

```bash
# Regenerate types
pnpm tsc --noEmit
```

## Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `lib/entityConfig.ts` | Central entity configuration | 1,600+ |
| `lib/api-factory.ts` | Type-safe API registry | 174 |
| `lib/api.ts` | API client implementations | 649 |
| `lib/settingsLoader.ts` | Dynamic settings loader | 270 |
| `pages/shared/EntityListOfInstancesPage.tsx` | Universal list page | 280 |
| `pages/shared/EntitySpecificInstancePage.tsx` | Universal detail page | 527 |
| `pages/setting/SettingsPage.tsx` | Universal settings page | 92 |
| `App.tsx` | Route definitions | 300+ |

## Support & Documentation

- **Main README:** `/home/rabin/projects/pmo/README.md`
- **API Documentation:** `/home/rabin/projects/pmo/apps/api/README.md`
- **Database Schema:** `/home/rabin/projects/pmo/db/README.md`
- **Management Tools:** `/home/rabin/projects/pmo/tools/README.md`

---

**Last Updated:** 2025-10-18
**Framework:** React 19
**Build Tool:** Vite 5
**Total Components:** 50+
**Universal Components:** 4
**Code Reduction:** ~94%
