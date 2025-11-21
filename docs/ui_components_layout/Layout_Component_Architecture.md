# Frontend Architecture - Component, Page & State Design

> **React 19, TypeScript, Backend-Driven Metadata, Zero Pattern Detection**
> Universal page system with 3 pages handling 27+ entity types dynamically

**Version:** 4.0 (Backend Metadata Architecture)
**Last Updated:** 2025-11-20

---

## 1. Architecture Overview

### Core Principle: Universal Pages + Backend Metadata

The PMO platform uses a **universal page architecture** where 3 main pages handle all 27+ entity types dynamically using **backend-generated metadata**. No entity-specific pages or components.

```
┌─────────────────────────────────────────────────────────────────┐
│                     UNIVERSAL PAGE SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EntityListOfInstancesPage.tsx        → Handles ALL entity list views     │
│    ├── /project             (projects list)                    │
│    ├── /task                (tasks list)                       │
│    ├── /employee            (employees list)                   │
│    └── ... 27+ entities                                        │
│                                                                 │
│  EntitySpecificInstancePage.tsx      → Handles ALL entity detail views   │
│    ├── /project/:id         (project detail + child tabs)     │
│    ├── /task/:id            (task detail + child tabs)        │
│    ├── /employee/:id        (employee detail + child tabs)    │
│    └── ... 27+ entities                                        │
│                                                                 │
│  EntityFormPage.tsx        → Handles ALL entity forms          │
│    ├── /project/new         (create project)                  │
│    ├── /project/:id/edit    (edit project)                    │
│    └── ... 27+ entities                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                   Backend Metadata Drives
                   ALL Rendering Decisions
```

---

## 2. Page Architecture

### 2.1 EntityListOfInstancesPage.tsx

**Purpose**: List/grid/kanban views for any entity type

**Location**: `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

**Responsibilities**:
1. Fetch entity data from API (`GET /api/v1/{entity}`)
2. Receive backend metadata in API response
3. Pass metadata to child components
4. Handle view mode switching (table/kanban/calendar)
5. Handle pagination, filtering, sorting
6. Handle entity creation (inline or modal)

**State Management**:
```typescript
const [data, setData] = useState<any[]>([]);
const [metadata, setMetadata] = useState<EntityMetadata | null>(null);
const [loading, setLoading] = useState(true);
const [currentPage, setCurrentPage] = useState(1);
const [filters, setFilters] = useState<Record<string, any>>({});
const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'calendar'>('table');
```

**Data Flow**:
```
1. URL: /project
   ↓
2. EntityListOfInstancesPage extracts entityType from route
   ↓
3. Fetch: GET /api/v1/project
   ↓
4. Backend returns: { data: [...], metadata: {...} }
   ↓
5. Pass to FilteredDataTable(data, metadata)
   ↓
6. EntityDataTable renders using metadata
```

**Key Props**:
- None (reads from route params)

### 2.2 EntitySpecificInstancePage.tsx

**Purpose**: Detail view with child entity tabs for any entity type

**Location**: `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`

**Responsibilities**:
1. Fetch single entity record (`GET /api/v1/{entity}/{id}`)
2. Receive backend metadata
3. Render detail fields using `renderViewModeFromMetadata`
4. Display child entity tabs dynamically
5. Handle inline editing
6. Handle entity deletion

**State Management**:
```typescript
const [record, setRecord] = useState<any>(null);
const [metadata, setMetadata] = useState<EntityMetadata | null>(null);
const [loading, setLoading] = useState(true);
const [editing, setEditing] = useState(false);
const [activeTab, setActiveTab] = useState<string>('overview');
```

**Child Tabs (Dynamic)**:
```typescript
// DynamicChildEntityTabs.tsx reads entity.child_entity_codes
// Example for project:
child_entity_codes: ['task', 'artifact', 'wiki', 'cost']

// Renders tabs:
<Tabs>
  <Tab key="overview">Overview</Tab>
  <Tab key="task">Tasks</Tab>        {/* /project/:id/task */}
  <Tab key="artifact">Artifacts</Tab>
  <Tab key="wiki">Wiki</Tab>
  <Tab key="cost">Costs</Tab>
</Tabs>
```

**Data Flow**:
```
1. URL: /project/abc123
   ↓
2. EntitySpecificInstancePage extracts entityType + id
   ↓
3. Fetch: GET /api/v1/project/abc123
   ↓
4. Backend returns: { data: {...}, metadata: {...} }
   ↓
5. Render fields using renderViewModeFromMetadata
   ↓
6. DynamicChildEntityTabs queries entity table for child_entity_codes
   ↓
7. Render child tabs (each calls FilteredDataTable with parent context)
```

### 2.3 EntityFormPage.tsx

**Purpose**: Create/edit forms for any entity type

**Location**: `apps/web/src/pages/shared/EntityFormPage.tsx`

**Responsibilities**:
1. Fetch entity metadata (create mode) or record + metadata (edit mode)
2. Render form fields using `renderEditModeFromMetadata`
3. Handle form submission
4. Handle validation errors
5. Redirect after save

**State Management**:
```typescript
const [formData, setFormData] = useState<Record<string, any>>({});
const [metadata, setMetadata] = useState<EntityMetadata | null>(null);
const [errors, setErrors] = useState<Record<string, string>>({});
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
```

**Data Flow (Create)**:
```
1. URL: /project/new
   ↓
2. EntityFormPage extracts entityType
   ↓
3. Fetch metadata: GET /api/v1/project (empty list for metadata)
   ↓
4. Backend returns: { data: [], metadata: {...} }
   ↓
5. EntityFormContainer renders fields using metadata.inputType
   ↓
6. User fills form
   ↓
7. Submit: POST /api/v1/project
   ↓
8. Redirect: /project or /project/:id
```

**Data Flow (Edit)**:
```
1. URL: /project/abc123/edit
   ↓
2. Fetch: GET /api/v1/project/abc123
   ↓
3. Backend returns: { data: {...}, metadata: {...} }
   ↓
4. EntityFormContainer pre-fills form with data
   ↓
5. User edits
   ↓
6. Submit: PATCH /api/v1/project/abc123
   ↓
7. Redirect: /project/abc123
```

---

## 3. Component Architecture

### 3.1 Component Hierarchy

```
┌────────────────────────────────────────────────────────────────┐
│                         APP LEVEL                              │
├────────────────────────────────────────────────────────────────┤
│  App.tsx                                                       │
│    ├── Router (React Router v6)                               │
│    ├── AuthProvider (Authentication context)                  │
│    ├── EntityMetadataProvider (Entity metadata cache)         │
│    └── ToastProvider (Notifications)                          │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                       LAYOUT LEVEL                             │
├────────────────────────────────────────────────────────────────┤
│  Layout.tsx                                                    │
│    ├── Sidebar (Navigation)                                   │
│    ├── Topbar (User menu, search)                            │
│    └── <Outlet /> (Page content)                             │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                        PAGE LEVEL                              │
├────────────────────────────────────────────────────────────────┤
│  EntityListOfInstancesPage / EntitySpecificInstancePage / EntityFormPage           │
│    ├── Breadcrumbs                                            │
│    ├── ActionButtons (Create, Edit, Delete)                  │
│    └── Content Container                                      │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                     CONTAINER LEVEL                            │
├────────────────────────────────────────────────────────────────┤
│  FilteredDataTable (Routing + wrapper)                        │
│    ├── EntityDataTable (Entity data)                         │
│    └── SettingsDataTable (Datalabel data)                    │
│                                                                │
│  EntityFormContainer (Form rendering)                         │
│    ├── renderEditModeFromMetadata for each field             │
│    └── Form validation                                        │
│                                                                │
│  DynamicChildEntityTabs (Child entity tabs)                  │
│    └── FilteredDataTable per tab                             │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                       UI COMPONENT LEVEL                       │
├────────────────────────────────────────────────────────────────┤
│  DataTableBase (Pure base table)                             │
│    ├── Table structure                                        │
│    ├── Sorting UI                                             │
│    ├── Inline editing pattern                                │
│    └── NO formatting logic                                    │
│                                                                │
│  EntityDataTable (Entity data extension)                     │
│    ├── Extends DataTableBase                                 │
│    ├── Uses renderViewModeFromMetadata                       │
│    ├── Uses renderEditModeFromMetadata                       │
│    └── Backend metadata-driven                               │
│                                                                │
│  SettingsDataTable (Settings extension)                      │
│    ├── Extends DataTableBase                                 │
│    ├── Uses renderDataLabelBadge                             │
│    └── Reorderable rows                                       │
│                                                                │
│  ColoredDropdown (Dropdown with badges)                      │
│    ├── Portal rendering (no clipping)                        │
│    ├── Colored options                                        │
│    └── Smart positioning                                      │
│                                                                │
│  DAGVisualizer (Workflow visualization)                      │
│    ├── Stage-based workflow view                             │
│    └── Used for dl__*_stage fields                           │
│                                                                │
│  KanbanBoard (Kanban view)                                    │
│    ├── Column-based card view                                │
│    └── Drag & drop                                            │
│                                                                │
│  CalendarView (Calendar view)                                 │
│    ├── Date-based event view                                 │
│    └── Event scheduling                                       │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Components

#### FilteredDataTable

**Purpose**: Routing wrapper that delegates to correct table type

**Location**: `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx`

**Props**:
```typescript
interface FilteredDataTableProps {
  entityType: string;           // 'project', 'task', etc.
  parentCode?: string;          // For child entity filtering
  parentId?: string;            // Parent UUID
  inlineEditable?: boolean;     // Enable inline editing
  selectable?: boolean;         // Enable row selection
}
```

**Key Logic**:
```typescript
// Route to correct table type
if (entityType.startsWith('setting_')) {
  return <SettingsDataTable ... />;
}
return <EntityDataTable metadata={metadata} data={data} ... />;
```

#### EntityDataTable

**Purpose**: Universal data table for all entity types (backend metadata-driven)

**Location**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Props**:
```typescript
interface EntityDataTableProps<T> {
  data: T[];                    // Entity records
  metadata?: EntityMetadata;    // Backend metadata (PRIORITY 1)
  columns?: Column[];           // Fallback columns
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  inlineEditable?: boolean;
  selectable?: boolean;
  loading?: boolean;
}
```

**Column Generation** (Backend Metadata Priority):
```typescript
const columns = useMemo(() => {
  // PRIORITY 1: Backend Metadata (100% backend-driven)
  if (metadata?.fields) {
    return metadata.fields
      .filter(f => f.visible.EntityDataTable === true)
      .map(fieldMeta => ({
        key: fieldMeta.key,
        title: fieldMeta.label,
        width: fieldMeta.width,
        align: fieldMeta.align,
        backendMetadata: fieldMeta,  // Store for rendering
        // Backend tells frontend how to render
        render: (value, record) =>
          renderViewModeFromMetadata(value, fieldMeta, record)
      }));
  }

  // PRIORITY 2: Fallback columns (for non-integrated routes)
  if (columns) {
    return columns.map(col => ({
      ...col,
      render: (value, record) => {
        const fallbackMeta = createFallbackMetadata(col.key);
        return renderViewModeFromMetadata(value, fallbackMeta, record);
      }
    }));
  }

  return [];
}, [metadata, columns]);
```

**Edit Mode Rendering**:
```typescript
// Get backend metadata for field
const backendMeta = column.backendMetadata as BackendFieldMetadata | undefined;
const fieldEditable = backendMeta?.editable ?? column.editable ?? false;
const editType = backendMeta?.inputType ?? column.editType ?? 'text';

// Render based on backend instructions
if (isEditing && fieldEditable) {
  if (editType === 'file') {
    return <InlineFileUploadCell accept={backendMeta?.accept} ... />;
  } else if (editType === 'select' && hasSettingOptions) {
    return <ColoredDropdown options={settingsOptions} ... />;
  } else {
    // ALL OTHER FIELDS - Backend metadata-driven
    return renderEditModeFromMetadata(
      value,
      backendMeta || createFallbackMetadata(column.key),
      onChange
    );
  }
}
```

#### EntityFormContainer

**Purpose**: Universal form for create/edit any entity type

**Location**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Props**:
```typescript
interface EntityFormContainerProps {
  entityType: string;
  entityId?: string;           // For edit mode
  initialData?: any;           // Pre-fill data
  metadata?: EntityMetadata;   // Backend metadata
  onSave?: (data: any) => void;
  onCancel?: () => void;
}
```

**Field Rendering**:
```typescript
// Get backend metadata for field
const fieldMeta = metadata?.fields.find(f => f.key === fieldKey);

// Render based on backend inputType
return renderEditModeFromMetadata(
  formData[fieldKey],
  fieldMeta,
  (newValue) => setFormData({ ...formData, [fieldKey]: newValue })
);
```

#### DynamicChildEntityTabs

**Purpose**: Render child entity tabs based on entity.child_entity_codes

**Location**: `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

**Props**:
```typescript
interface DynamicChildEntityTabsProps {
  parentEntityType: string;    // 'project'
  parentEntityId: string;      // UUID
}
```

**Tab Generation**:
```typescript
// Fetch entity metadata to get child_entity_codes
const entityMeta = await fetch(`/api/v1/entity/codes/${parentEntityType}`);
const childCodes = entityMeta.child_entity_codes; // ['task', 'artifact', 'wiki']

// Render tab for each child
childCodes.map(childCode => (
  <Tab key={childCode} label={childCode}>
    <FilteredDataTable
      entityType={childCode}
      parentCode={parentEntityType}
      parentId={parentEntityId}
    />
  </Tab>
));
```

---

## 4. State Management

### 4.1 Global State (Context)

#### EntityMetadataContext

**Purpose**: Cache entity metadata globally to avoid redundant API calls

**Location**: `apps/web/src/contexts/EntityMetadataContext.tsx`

**State**:
```typescript
interface EntityMetadataState {
  entities: Map<string, EntityType>;  // entityCode → entity metadata
  loading: boolean;
  error: string | null;
}
```

**Usage**:
```typescript
const { getEntity, entities } = useEntityMetadata();

// Get entity metadata
const projectEntity = getEntity('project');
// Returns: { code: 'project', label: 'Projects', icon: 'Briefcase', child_entity_codes: [...] }
```

**Cache Strategy**:
- Fetch all entities on app load: `GET /api/v1/entity/codes`
- Store in Map for O(1) lookups
- Refresh on entity updates
- 5-minute TTL

#### AuthContext

**Purpose**: Authentication state and user info

**Location**: `apps/web/src/contexts/AuthContext.tsx`

**State**:
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
}
```

**Methods**:
```typescript
const { login, logout, user, isAuthenticated } = useAuth();

// Login
await login(email, password);

// Logout
logout();

// Check auth
if (isAuthenticated) { ... }
```

### 4.2 Component-Level State

**Page State Pattern**:
```typescript
// EntityListOfInstancesPage.tsx
const [data, setData] = useState<any[]>([]);
const [metadata, setMetadata] = useState<EntityMetadata | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(50);
const [total, setTotal] = useState(0);
const [filters, setFilters] = useState<Record<string, any>>({});
const [sortBy, setSortBy] = useState<string | null>(null);
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
```

**Form State Pattern**:
```typescript
// EntityFormPage.tsx
const [formData, setFormData] = useState<Record<string, any>>({});
const [errors, setErrors] = useState<Record<string, string>>({});
const [touched, setTouched] = useState<Record<string, boolean>>({});
const [dirty, setDirty] = useState(false);
const [saving, setSaving] = useState(false);
```

### 4.3 URL State (React Router)

**Route Params**:
```typescript
// /project/abc123/task
const { entityType, entityId, childEntityType } = useParams();
// entityType: 'project'
// entityId: 'abc123'
// childEntityType: 'task'
```

**Query Params**:
```typescript
// /project?page=2&search=kitchen&dl__project_stage=planning
const [searchParams, setSearchParams] = useSearchParams();

const page = searchParams.get('page');           // '2'
const search = searchParams.get('search');       // 'kitchen'
const stage = searchParams.get('dl__project_stage'); // 'planning'
```

---

## 5. Custom Hooks

### 5.1 Data Fetching Hooks

#### useEntityData

**Purpose**: Fetch entity list data with pagination

**Location**: `apps/web/src/lib/hooks/useEntityData.ts`

**Usage**:
```typescript
const {
  data,
  metadata,
  loading,
  error,
  total,
  refetch
} = useEntityData(entityType, {
  page: 1,
  limit: 50,
  filters: {},
  parentCode: 'project',
  parentId: 'abc123'
});
```

**Implementation**:
```typescript
export function useEntityData(entityType: string, options: UseEntityDataOptions) {
  const [data, setData] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<EntityMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams({
          page: String(options.page),
          limit: String(options.limit),
          ...options.filters,
          ...(options.parentCode && { parent_code: options.parentCode }),
          ...(options.parentId && { parent_id: options.parentId })
        });

        const response = await fetch(
          `/api/v1/${entityType}?${queryParams}`
        );
        const result = await response.json();

        setData(result.data);
        setMetadata(result.metadata);
        setTotal(result.total);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [entityType, options.page, options.limit, options.filters]);

  return { data, metadata, loading, error, total, refetch };
}
```

#### useEntityInstance

**Purpose**: Fetch single entity instance record

**Location**: `apps/web/src/lib/hooks/useEntityQuery.ts`

**Usage**:
```typescript
const {
  data,
  isLoading,
  error,
  refetch
} = useEntityInstance(entityCode, entityId);
```

### 5.2 Form Hooks

#### useEntityForm

**Purpose**: Form state management with validation

**Location**: `apps/web/src/lib/hooks/useEntityForm.ts`

**Usage**:
```typescript
const {
  formData,
  errors,
  touched,
  dirty,
  handleChange,
  handleBlur,
  handleSubmit,
  reset
} = useEntityForm(initialData, onSubmit);
```

### 5.3 UI Hooks

#### useColumnVisibility

**Purpose**: Manage table column visibility

**Location**: `apps/web/src/lib/hooks/useColumnVisibility.ts`

**Usage**:
```typescript
const {
  visibleColumns,
  toggleColumn,
  showAll,
  hideAll
} = useColumnVisibility(columns);
```

---

## 6. Rendering Patterns

### 6.1 Backend Metadata-Driven Rendering

**Core Principle**: Backend generates complete metadata, frontend executes instructions exactly

**View Mode**:
```typescript
import { renderViewModeFromMetadata } from '@/lib/frontEndFormatterService';

// Backend metadata
const fieldMeta: BackendFieldMetadata = {
  key: 'budget_allocated_amt',
  renderType: 'currency',
  format: { symbol: '$', decimals: 2 }
};

// Frontend renders
const rendered = renderViewModeFromMetadata(50000, fieldMeta);
// Returns: <span className="font-mono">$50,000.00</span>
```

**Edit Mode**:
```typescript
import { renderEditModeFromMetadata } from '@/lib/frontEndFormatterService';

// Backend metadata
const fieldMeta: BackendFieldMetadata = {
  key: 'budget_allocated_amt',
  inputType: 'currency',
  format: { symbol: '$', decimals: 2 }
};

// Frontend renders
const rendered = renderEditModeFromMetadata(50000, fieldMeta, onChange);
// Returns: <input type="number" step="0.01" value={50000} onChange={onChange} />
```

### 6.2 Conditional Rendering

**Metadata Availability**:
```typescript
// Priority 1: Backend metadata (preferred)
if (metadata?.fields) {
  return renderWithBackendMetadata(metadata);
}

// Priority 2: EntityConfig (fallback)
if (config?.columns) {
  return renderWithEntityConfig(config);
}

// Priority 3: Empty state
return <EmptyState />;
```

**Permission-Based**:
```typescript
// Check user permissions
if (canEdit(entityType, entityId)) {
  return <EditButton />;
}

if (canDelete(entityType, entityId)) {
  return <DeleteButton />;
}
```

### 6.3 Loading States

**Skeleton Loading**:
```typescript
if (loading) {
  return <TableSkeleton rows={10} columns={6} />;
}

if (error) {
  return <ErrorState message={error} onRetry={refetch} />;
}

return <EntityDataTable data={data} metadata={metadata} />;
```

---

## 7. Performance Optimizations

### 7.1 Memoization

**Component Memoization**:
```typescript
import { memo } from 'react';

export const EntityDataTable = memo(function EntityDataTable(props) {
  // Component implementation
}, (prevProps, nextProps) => {
  return prevProps.data === nextProps.data
    && prevProps.metadata === nextProps.metadata;
});
```

**Value Memoization**:
```typescript
const columns = useMemo(() => {
  if (metadata?.fields) {
    return metadata.fields
      .filter(f => f.visible.EntityDataTable === true)
      .map(fieldMeta => ({
        key: fieldMeta.key,
        title: fieldMeta.label,
        render: (value, record) =>
          renderViewModeFromMetadata(value, fieldMeta, record)
      }));
  }
  return [];
}, [metadata]);
```

**Callback Memoization**:
```typescript
const handleEdit = useCallback((id: string) => {
  navigate(`/${entityType}/${id}/edit`);
}, [entityType, navigate]);
```

### 7.2 Lazy Loading

**Code Splitting**:
```typescript
// React.lazy for route-level splitting
const EntityListOfInstancesPage = lazy(() => import('./pages/shared/EntityListOfInstancesPage'));
const EntitySpecificInstancePage = lazy(() => import('./pages/shared/EntitySpecificInstancePage'));
const EntityFormPage = lazy(() => import('./pages/shared/EntityFormPage'));

// Routes
<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/:entityType" element={<EntityListOfInstancesPage />} />
    <Route path="/:entityType/:id" element={<EntitySpecificInstancePage />} />
    <Route path="/:entityType/:id/edit" element={<EntityFormPage />} />
  </Routes>
</Suspense>
```

**Component Lazy Loading**:
```typescript
const KanbanBoard = lazy(() => import('./components/KanbanBoard'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const DAGVisualizer = lazy(() => import('./components/DAGVisualizer'));
```

### 7.3 Data Caching

**Entity Metadata Cache**:
```typescript
// EntityMetadataContext caches all entity metadata
// 5-minute TTL, avoids redundant API calls
const { getEntity } = useEntityMetadata();
const projectEntity = getEntity('project'); // O(1) lookup from cache
```

**Settings Color Cache**:
```typescript
// loadSettingsColors caches datalabel colors
await loadSettingsColors(['project_stage', 'task_priority']);
// Subsequent calls use cache (no API requests)
const color = getSettingColor('project_stage', 'planning');
```

---

## 8. Key Design Patterns

### 8.1 Composition over Inheritance

**Base Component + Extensions**:
```
DataTableBase (pure base)
    ├── EntityDataTable (entity extension)
    └── SettingsDataTable (settings extension)
```

### 8.2 Render Props

**Flexible Cell Rendering**:
```typescript
<EntityDataTable
  data={data}
  columns={columns}
  renderCell={(value, column, record) => {
    if (column.key === 'custom_field') {
      return <CustomRenderer value={value} />;
    }
    return renderViewModeFromMetadata(value, column.backendMetadata, record);
  }}
/>
```

### 8.3 Portal Rendering

**Dropdowns in Tables**:
```typescript
import { createPortal } from 'react-dom';

// Render dropdown to document.body (avoids clipping)
{isOpen && createPortal(
  <div style={{ position: 'absolute', zIndex: 9999 }}>
    {/* Dropdown content */}
  </div>,
  document.body
)}
```

### 8.4 Controlled Components

**Form Inputs**:
```typescript
<input
  type="text"
  value={formData.name}
  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
/>
```

---

## 9. Error Handling

### 9.1 Error Boundaries

**Component Error Boundary**:
```typescript
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onReset={() => window.location.reload()}
>
  <EntityDataTable ... />
</ErrorBoundary>
```

### 9.2 API Error Handling

**Standard Pattern**:
```typescript
try {
  const response = await fetch('/api/v1/project');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  setData(data.data);
} catch (error) {
  setError(error.message);
  toast.error(`Failed to load projects: ${error.message}`);
}
```

---

## 10. Testing Strategy

### 10.1 Component Tests

**Unit Test Example**:
```typescript
import { render, screen } from '@testing-library/react';
import { EntityDataTable } from './EntityDataTable';

test('renders table with backend metadata', () => {
  const metadata: EntityMetadata = {
    entity: 'project',
    fields: [
      { key: 'name', label: 'Name', renderType: 'text', ... }
    ]
  };

  render(<EntityDataTable data={[]} metadata={metadata} />);
  expect(screen.getByText('Name')).toBeInTheDocument();
});
```

### 10.2 Integration Tests

**Page Test Example**:
```typescript
test('EntityListOfInstancesPage loads and displays data', async () => {
  render(<EntityListOfInstancesPage />, { wrapper: RouterWrapper });

  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  // Check data is rendered
  expect(screen.getByText('Project List')).toBeInTheDocument();
});
```

---

## Summary

**Architecture**: Universal Pages + Backend Metadata + Zero Frontend Pattern Detection

**Key Components**:
- **3 Universal Pages**: EntityListOfInstancesPage, EntitySpecificInstancePage, EntityFormPage
- **2 Data Tables**: EntityDataTable (backend metadata), SettingsDataTable (datalabels)
- **1 Form Container**: EntityFormContainer (backend metadata)
- **Dynamic Child Tabs**: DynamicChildEntityTabs (entity.child_entity_codes)

**State Management**:
- **Global**: EntityMetadataContext (cache), AuthContext (authentication)
- **Component**: useState for local state
- **URL**: React Router for routing state

**Rendering**:
- **Backend-Driven**: renderViewModeFromMetadata, renderEditModeFromMetadata
- **Zero Pattern Detection**: Frontend is pure renderer

**Performance**:
- **Code Splitting**: Lazy loading routes and heavy components
- **Memoization**: useMemo, useCallback for expensive computations
- **Caching**: Entity metadata, settings colors

**Status**: ✅ Production Ready - v4.0 Backend Metadata Architecture
