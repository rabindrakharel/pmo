# Data Flow Architecture

## System Overview

The PMO platform implements a **unidirectional data flow** pattern with intelligent caching layers. Data flows from the backend API through Zustand cache stores to route components and finally to presentation components. This architecture ensures predictable state updates, eliminates data synchronization issues, and optimizes performance through strategic caching.

## Backend Services Overview

Two core backend services work together to generate API responses:

| Service | File | Responsibilities | Documentation |
|---------|------|------------------|---------------|
| **Entity Infrastructure Service** | `entity-infrastructure.service.ts` | RBAC checks, instance registry, parent-child links | [entity-infrastructure.service.md](../services/entity-infrastructure.service.md) |
| **Backend Formatter Service** | `backend-formatter.service.ts` | Metadata generation (35+ patterns), datalabel fetching | [backend-formatter.service.md](../services/backend-formatter.service.md) |

### API Response → Store Mapping

Entity endpoints return only data and metadata. Datalabels and globalSettings have dedicated endpoints:

| Data Source | Endpoint | Frontend Store | Notes |
|-------------|----------|----------------|-------|
| `data` | `GET /api/v1/{entity}` | `EntityListOfInstancesDataStore` / `EntitySpecificInstanceDataStore` | URL-bound, 5 min TTL |
| `metadata` | `GET /api/v1/{entity}?view=...` | `entityComponentMetadataStore` | Piggybacks on entity response |
| `datalabels` | `GET /api/v1/datalabel?name=<name>` | `datalabelMetadataStore` | **Dedicated endpoint** (30 min TTL) |
| `globalSettings` | `GET /api/v1/settings/global` | `globalSettingsMetadataStore` | **Dedicated endpoint** (30 min TTL) |

## Data Flow Diagram with Caching Layer

```
┌────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL Database                        │
│  • Source of truth for all business data                          │
│  • 50+ tables with JSONB metadata columns                         │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                      Fastify API Backend                           │
│  Entity Infrastructure Service    Backend Formatter Service        │
│  ┌────────────────────────┐      ┌────────────────────────┐       │
│  │ • RBAC permission check│      │ • Metadata generation  │       │
│  │ • Instance registry    │      │ • Pattern detection    │       │
│  │ • Link management      │      └────────────────────────┘       │
│  └────────────────────────┘                                        │
│  Entity Response: { data, fields, metadata }                       │
│  Dedicated Endpoints: /api/v1/settings/global, /api/v1/datalabel   │
└────────────────────┬───────────────────────────────────────────────┘
                     │ HTTP/JSON
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                    🆕 Zustand Cache Layer (9 Stores)               │
│  SESSION-LEVEL (30 min TTL, SessionStorage):                       │
│  • globalSettingsMetadataStore - Currency, date, timestamp config  │
│  • datalabelMetadataStore - Dropdown options (dl__* fields)        │
│  • entityCodeMetadataStore - Sidebar navigation                    │
│  • entityComponentMetadataStore - Field metadata per component     │
│  URL-BOUND (5 min TTL, SessionStorage):                            │
│  • EntitySpecificInstanceDataStore - Single entity (/entity/:id)   │
│  • EntityListOfInstancesDataStore - List data (/entity?params)     │
│  OTHER (Memory):                                                   │
│  • useEntityEditStore - Edit state, dirty tracking, undo/redo      │
│  • useEntityStore - Monolithic entity state (alternative)          │
│  • uiStateStore - UI preferences (sidebar, view modes)             │
└────────────────────┬───────────────────────────────────────────────┘
                     │ Cached Data
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Route Components (Pages)                       │
│  • EntityListOfInstancesPage, EntitySpecificInstancePage, EntityFormPage               │
│  • Check cache before fetching                                    │
│  • Distributes cached data to children                            │
└────────────────────┬───────────────────────────────────────────────┘
                     │ Props
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Container Components                              │
│  • EntityFormContainer, EntityDataTable                           │
│  • Compute derived state with useMemo                             │
│  • Manage local UI state                                          │
└────────────────────┬───────────────────────────────────────────────┘
                     │ Props
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                  Presentation Components                           │
│  • DAGVisualizer, FormField, Badge                                │
│  • Pure components, no side effects                               │
│  • Render based on props only                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Caching Strategy

### Cache Categories & Lifecycle

#### Session-Level Stores (fetched on login)

| Store | Endpoint | Purpose | TTL | Invalidation | Storage |
|-------|----------|---------|-----|--------------|---------|
| `entityCodeMetadataStore` | `GET /api/v1/entity/codes` | Sidebar navigation | 30 min | On login | SessionStorage |
| `datalabelMetadataStore` | `GET /api/v1/settings/datalabels/all` | Dropdown options | 30 min | On login | SessionStorage |
| `globalSettingsMetadataStore` | `GET /api/v1/settings/global` | App formatting config | 30 min | On login | SessionStorage |

#### URL-Bound Stores (invalidate on URL change)

| Store | Populated By | Purpose | TTL | Invalidation | Storage |
|-------|--------------|---------|-----|--------------|---------|
| `entityComponentMetadataStore` | Entity API responses (`metadata`) | Field definitions | 5 min | URL exit | SessionStorage |
| `EntityListOfInstancesDataStore` | `GET /api/v1/{entity}` | Table data | 5 min | URL exit | SessionStorage |
| `EntitySpecificInstanceDataStore` | `GET /api/v1/{entity}/{id}` | Detail views + optimistic updates | 5 min | URL exit | SessionStorage |

**Important**: `entityComponentMetadataStore` is populated as a side-effect of entity endpoint responses. The metadata is generated by backend based on SQL query columns and cannot be fetched independently.

### URL-Bound Cache Behavior

URL-bound caches (`entityComponentMetadataStore`, `EntitySpecificInstanceDataStore`, `EntityListOfInstancesDataStore`) follow these rules:

1. **Fetch on URL entry**: Data only fetched when user navigates to that URL route
2. **Invalidate on URL exit**: Cache cleared immediately when navigating away
3. **5 min TTL fallback**: Also invalidates after 5 minutes if user stays on same page
4. **Optimistic updates**: Changes tracked with `isDirty` flag until backend sync

### Session-Level Cache Behavior

Session-level caches (`globalSettingsMetadataStore`, `datalabelMetadataStore`, `entityCodeMetadataStore`) follow these rules:

1. **Fetch on login**: Data fetched once when user logs in
2. **Cached for session**: Remains cached for entire session (30 min TTL)
3. **Refreshed on next login**: Fresh data fetched on each new login

### Cache Flow Example

```
09:00  Login → Fetch & cache session stores (entity codes via /api/v1/entity/codes)
              → Fetch globalSettings via /api/v1/settings/global (30-min cache)
              → Datalabels fetched on-demand via /api/v1/datalabel?name=<name>
09:01  Navigate to /office → Fetch office list + metadata (URL-bound)
09:02  Click row → /office/123 → INVALIDATE URL-bound caches, fetch detail + metadata
09:03  Edit & Save → PATCH only changed fields, update instanceDataStore
09:04  Back to /office → INVALIDATE detail URL caches, refetch list + metadata
09:07  Navigate to /task → INVALIDATE office URL caches, fetch task data + metadata
09:10  Stay on /task → 5 min TTL expires → background refetch
Next login → All session stores refreshed
```

## Detailed Component Flow

### 1. List View → Detail View Flow

```typescript
// STEP 1: User lands on /business page
// ========================================
// Location: apps/web/src/pages/BusinessPage.tsx

function BusinessPage() {
  // Fetch list of businesses with metadata
  const { data: response, isLoading } = useQuery(
    ['businesses', filters, page],
    async () => {
      const res = await fetch('/api/v1/business?view=entityDataTable');
      return res.json();
    }
  );

  // Datalabels fetched via dedicated hook (30-min session cache)
  // Note: useDatalabels() automatically caches to datalabelMetadataStore
  const { options: stageOptions } = useDatalabels('dl__business_stage');

  /* Response structure:
  {
    data: Business[],
    metadata: {
      entity: 'business',
      fields: BackendFieldMetadata[]
    },
    total: number,
    limit: number,
    offset: number
  }
  // Note: datalabels NOT in entity response - fetched via useDatalabels() hook
  */

  return (
    <EntityListOfInstancesPage
      entityType="business"
      data={response?.data}
      metadata={response?.metadata}
    />
  );
}

// STEP 2: EntityListOfInstancesPage renders table
// ========================================
// Location: apps/web/src/pages/entity/EntityListOfInstancesPage.tsx

function EntityListOfInstancesPage({ entityType, data, metadata }) {
  const navigate = useNavigate();

  // Datalabels fetched via useDatalabels() hook per field (cached 30 min)
  // Components like EntityDataTable use useDatalabels() internally

  const handleRowClick = (item: any) => {
    // Navigate to detail view
    navigate(`/${entityType}/${item.id}`);
  };

  return (
    <EntityDataTable
      data={data}
      columns={generateColumnsFromMetadata(metadata)}
      // Note: datalabels fetched internally via useDatalabels() hook
      onRowClick={handleRowClick}
      inlineEditable={true}
    />
  );
}

// STEP 3: User clicks row, navigates to /business/123
// ========================================
// Route: /business/:id → BusinessDetailPage

function BusinessDetailPage({ id }) {
  // Fetch single business with all relationships
  const { data: response } = useQuery(
    ['business', id],
    async () => {
      const res = await fetch(`/api/v1/business/${id}?view=entityFormContainer`);
      return res.json();
    }
  );

  /* Response structure:
  {
    data: {
      ...businessFields,
      _children: {
        projects: Project[],
        offices: Office[]
      }
    },
    metadata: BackendMetadata,
    permissions: Permission[]
  }
  // Note: datalabels NOT in response - fetched via useDatalabels() hook
  */

  return (
    <EntitySpecificInstancePage
      entityType="business"
      data={response?.data}
      metadata={response?.metadata}
    />
  );
}

// STEP 4: EntitySpecificInstancePage renders details and tabs
// ========================================
// Location: apps/web/src/pages/entity/EntitySpecificInstancePage.tsx

function EntitySpecificInstancePage({ entityType, data, metadata }) {
  // Datalabels fetched via useDatalabels() hook (30-min cache)
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Pass all data down to children
  return (
    <div className="entity-detail">
      <EntityHeader
        title={data.name}
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="overview">
          <EntityFormContainer
            data={data}
            metadata={metadata}
            // Datalabels fetched internally via useDatalabels() hook (30-min cache)
            isEditing={isEditing}
            onChange={handleFieldChange}
          />
        </Tab>

        <Tab value="projects">
          <EntityDataTable
            data={data._children.projects}
            metadata={metadata.children.project}
            // Datalabels fetched internally via useDatalabels() hook
          />
        </Tab>
      </Tabs>
    </div>
  );
}
```

### 2. Form Field Rendering Flow

```typescript
// STEP 1: Backend sends field metadata
// ========================================
// Location: apps/api/src/modules/business/routes.ts

fastify.get('/api/v1/business/:id', async (request, reply) => {
  const business = await db.query(/* ... */);

  // Generate metadata from data
  const metadata = getEntityMetadata('business', business);

  /* Metadata structure:
  {
    entity: 'business',
    fields: [
      {
        key: 'dl__business_stage',
        label: 'Business Stage',
        renderType: 'badge',        // View mode
        inputType: 'select',         // Edit mode
        loadFromDataLabels: true,
        datalabelKey: 'dl__business_stage',
        visible: {
          EntityDataTable: true,
          EntityFormContainer: true
        }
      }
    ]
  }
  */

  // Note: datalabels NOT included in response (v3.4+)
  // Frontend fetches via GET /api/v1/datalabel?name=<name> and caches 30 min

  return {
    data: business,
    metadata
  };
});

// STEP 2: EntityFormContainer processes metadata
// ========================================
// Location: apps/web/src/components/shared/entity/EntityFormContainer.tsx

function EntityFormContainer({ data, metadata }) {
  // Convert backend metadata to form fields
  const fields = useMemo(() => {
    if (!metadata?.fields) return [];

    return metadata.fields
      .filter(f => f.visible.EntityFormContainer)
      .map(fieldMeta => ({
        key: fieldMeta.key,
        label: fieldMeta.label,
        type: fieldMeta.inputType,
        loadFromDataLabels: fieldMeta.loadFromDataLabels,
        datalabelKey: fieldMeta.datalabelKey
      }));
  }, [metadata]);

  // Fetch datalabels via dedicated hook (30-min session cache)
  // Each field that needs options calls useDatalabels() hook
  const datalabelFields = fields.filter(f => f.loadFromDataLabels);

  // Build options for select fields using useDatalabels() hook
  const { settingOptions, dagNodes } = useMemo(() => {
    const options = new Map();
    const nodes = new Map();

    datalabelFields.forEach(field => {
      // useDatalabels() is called per field with caching
      const { options: datalabelOptions } = useDatalabels(field.datalabelKey);
      if (datalabelOptions) {
        options.set(field.key, datalabelOptions);
        if (isStageField(field.key)) {
          nodes.set(field.key, transformToDAGNodes(datalabelOptions));
        }
      }
    });

    return { settingOptions: options, dagNodes: nodes };
  }, [datalabelFields]);

  // Render fields
  return (
    <div className="form-container">
      {fields.map(field => (
        <FormField
          key={field.key}
          field={field}
          value={data[field.key]}
          options={settingOptions.get(field.key)}
          dagNodes={dagNodes.get(field.key)}
          onChange={(value) => handleChange(field.key, value)}
        />
      ))}
    </div>
  );
}

// STEP 3: FormField renders appropriate input
// ========================================
// Location: Internal to EntityFormContainer

function FormField({ field, value, options, dagNodes, onChange }) {
  // Special rendering for stage fields with DAG
  if (dagNodes && dagNodes.length > 0) {
    return (
      <div className="field-wrapper">
        <label>{field.label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <DAGVisualizer
          nodes={dagNodes}
          currentNodeId={findNodeId(value, dagNodes)}
        />
      </div>
    );
  }

  // Standard field rendering
  return renderEditModeFromMetadata(value, field, onChange);
}
```

### 3. Child Entity Loading Flow

```typescript
// STEP 1: Parent entity includes child metadata
// ========================================
// Location: apps/api/src/modules/project/routes.ts

fastify.get('/api/v1/project/:id', async (request, reply) => {
  const project = await db.query(/* ... */);

  // Get child entities from entity table
  const entityInfo = await db.query(`
    SELECT child_entity_codes
    FROM app.entity
    WHERE entity_code = 'project'
  `);

  // Fetch children if requested
  if (request.query.include === 'all') {
    project._children = {
      tasks: await getChildEntities('task', project.id),
      artifacts: await getChildEntities('artifact', project.id)
    };
  }

  // Note: datalabels NOT included in response (v3.4+)
  return {
    data: project,
    childEntityCodes: entityInfo.child_entity_codes
  };
});

// STEP 2: DynamicChildEntityTabs renders tabs
// ========================================
// Location: apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx

function DynamicChildEntityTabs({
  parentType,
  parentId,
  parentData,
  childEntityCodes
  // Note: datalabels now fetched via useDatalabels() hook (30-min cache)
}) {
  // Generate tabs from child entity codes
  const tabs = useMemo(() => {
    return childEntityCodes.map(childCode => ({
      key: childCode,
      label: pluralize(childCode),
      icon: getEntityIcon(childCode)
    }));
  }, [childEntityCodes]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key);
  const [childData, setChildData] = useState({});

  // Load child data when tab changes
  useEffect(() => {
    if (activeTab && !childData[activeTab]) {
      fetch(`/api/v1/${parentType}/${parentId}/${activeTab}`)
        .then(r => r.json())
        .then(response => {
          setChildData(prev => ({
            ...prev,
            [activeTab]: response.data
          }));
        });
    }
  }, [activeTab, parentType, parentId]);

  return (
    <Tabs value={activeTab} onChange={setActiveTab}>
      {tabs.map(tab => (
        <Tab key={tab.key} value={tab.key}>
          <EntityDataTable
            data={childData[tab.key] || []}
            // Datalabels fetched internally via useDatalabels() hook (30-min cache)
            entityType={tab.key}
            parentContext={{ type: parentType, id: parentId }}
          />
        </Tab>
      ))}
    </Tabs>
  );
}
```

## State Synchronization Patterns

### 1. Optimistic Updates

```typescript
function useOptimisticUpdate() {
  const queryClient = useQueryClient();

  const updateEntity = useMutation(
    async ({ id, data }) => {
      return fetch(`/api/v1/entity/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }).then(r => r.json());
    },
    {
      // Optimistic update
      onMutate: async ({ id, data }) => {
        await queryClient.cancelQueries(['entity', id]);
        const previous = queryClient.getQueryData(['entity', id]);
        queryClient.setQueryData(['entity', id], old => ({
          ...old,
          data: { ...old.data, ...data }
        }));
        return { previous };
      },
      // Rollback on error
      onError: (err, vars, context) => {
        queryClient.setQueryData(['entity', vars.id], context.previous);
      },
      // Sync with server response
      onSettled: (data, error, { id }) => {
        queryClient.invalidateQueries(['entity', id]);
      }
    }
  );

  return updateEntity;
}
```

### 2. Cross-Component Updates

```typescript
// Use React Query for cross-component state sync
function useEntityData(entityType, entityId) {
  const queryKey = [entityType, entityId];

  const { data, isLoading } = useQuery(
    queryKey,
    () => fetchEntity(entityType, entityId),
    {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      cacheTime: 10 * 60 * 1000  // 10 minutes
    }
  );

  // Update function that syncs all components
  const updateEntity = useCallback((updates) => {
    queryClient.setQueryData(queryKey, old => ({
      ...old,
      data: { ...old.data, ...updates }
    }));
  }, [queryKey]);

  return { data, isLoading, updateEntity };
}

// Component A
function ComponentA() {
  const { data, updateEntity } = useEntityData('project', '123');
  // Updates here affect all components using same entity
}

// Component B
function ComponentB() {
  const { data } = useEntityData('project', '123');
  // Automatically receives updates from Component A
}
```

### 3. Parent-Child Data Sync

```typescript
// Parent component manages shared state
function ParentComponent() {
  const [sharedData, setSharedData] = useState(initialData);

  // Stable update function
  const updateSharedData = useCallback((key, value) => {
    setSharedData(prev => ({ ...prev, [key]: value }));
  }, []);

  // Pass stable references to children
  return (
    <>
      <ChildA data={sharedData} onUpdate={updateSharedData} />
      <ChildB data={sharedData} onUpdate={updateSharedData} />
    </>
  );
}
```

## Performance Considerations

### 1. Data Preloading Strategy

```typescript
// ❌ BAD: Waterfall loading
function BadComponent() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    fetch('/api/user').then(r => r.json()).then(setUser);
  }, []);

  useEffect(() => {
    if (user) {
      fetch(`/api/projects?userId=${user.id}`)
        .then(r => r.json()).then(setProjects);
    }
  }, [user]);  // Waits for user

  useEffect(() => {
    if (projects.length > 0) {
      fetch(`/api/tasks?projectId=${projects[0].id}`)
        .then(r => r.json()).then(setTasks);
    }
  }, [projects]);  // Waits for projects
}

// ✅ GOOD: Parallel loading with includes
function GoodComponent() {
  const { data } = useQuery('dashboard', async () => {
    const response = await fetch('/api/dashboard?include=user,projects,tasks');
    return response.json();
  });

  // All data available immediately
  const { user, projects, tasks } = data || {};
}
```

### 2. Selective Re-rendering

```typescript
// Use React.memo for expensive components
const ExpensiveChild = React.memo(({ data, onUpdate }) => {
  return <ComplexVisualization data={data} />;
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if data changes
  return prevProps.data === nextProps.data;
});

// Use useMemo for expensive computations
function ParentComponent({ items }) {
  const sortedItems = useMemo(() => {
    return items.sort((a, b) => b.priority - a.priority);
  }, [items]);

  const stats = useMemo(() => {
    return calculateStatistics(sortedItems);
  }, [sortedItems]);

  return <Dashboard items={sortedItems} stats={stats} />;
}
```

### 3. Batched Updates

```typescript
// Batch multiple state updates
function FormComponent() {
  const [formData, setFormData] = useState(initialData);

  // Single update for multiple fields
  const handleSubmit = () => {
    setFormData(prev => ({
      ...prev,
      field1: value1,
      field2: value2,
      field3: value3,
      submittedAt: Date.now()
    }));
    // React batches these into single re-render
  };
}
```

## Debugging Data Flow

### 1. React Query DevTools

```typescript
// Add to App.tsx
import { ReactQueryDevtools } from 'react-query/devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 2. Custom Data Flow Logger

```typescript
// Debug hook for tracking data flow
function useDataFlowLogger(componentName, props) {
  useEffect(() => {
    console.group(`📊 ${componentName} Data Flow`);
    console.log('Props received:', props);
    console.log('Has metadata:', !!props.metadata);
    // Note: datalabels now fetched via useDatalabels() hook (30-min cache)
    console.groupEnd();
  }, [componentName, props]);
}

// Use in components
function EntityFormContainer(props) {
  useDataFlowLogger('EntityFormContainer', props);
  // ... rest of component
}
```

### 3. Performance Monitoring

```typescript
// Monitor render performance
function useRenderMetrics(componentName) {
  const renderCount = useRef(0);
  const renderStart = useRef(performance.now());

  useEffect(() => {
    renderCount.current++;
    const renderTime = performance.now() - renderStart.current;

    if (renderTime > 16) {  // Longer than one frame
      console.warn(`⚠️ ${componentName} slow render: ${renderTime}ms`);
    }

    // Reset for next render
    renderStart.current = performance.now();
  });

  // Log total renders on unmount
  useEffect(() => {
    return () => {
      console.log(`📈 ${componentName} total renders: ${renderCount.current}`);
    };
  }, []);
}
```

## Common Pitfalls and Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| Infinite loops | Unstable dependencies | Use stable references |
| Stale data | Missing invalidation | Invalidate queries after mutations |
| Over-fetching | Loading unnecessary data | Use field selection in API |
| Under-fetching | Multiple sequential requests | Use includes parameter |
| Prop drilling | Passing through many levels | Use context or composition |
| Memory leaks | Missing cleanup | Add cleanup to useEffect |

## Zustand Cache Implementation

### 9 Specialized Stores Architecture

The PMO platform uses 9 specialized Zustand stores organized by cache lifecycle:

#### Session-Level Stores (30 min TTL)

```typescript
// 1. globalSettingsMetadataStore - Currency, date, timestamp formatting
interface GlobalSettingsMetadataStore {
  globalSettings: CacheEntry<GlobalSettings> | null;
  setGlobalSettings: (settings: GlobalSettings) => void;
  getGlobalSettings: () => GlobalSettings | null;
}

// 2. datalabelMetadataStore - Dropdown options for dl__* fields
interface DatalabelMetadataStore {
  datalabels: Record<string, CacheEntry>;  // key: 'dl__project_stage'
  setDatalabel: (name: string, options: DatalabelOption[]) => void;
  getDatalabel: (name: string) => DatalabelOption[] | null;
}

// 3. entityCodeMetadataStore - Sidebar navigation
interface EntityCodeMetadataStore {
  entityCodes: CacheEntry | null;  // Array + Map for O(1) lookup
  setEntityCodes: (entities: EntityCodeData[]) => void;
  getEntityByCode: (code: string) => EntityCodeData | null;
}

// 4. entityComponentMetadataStore - Field metadata per component
interface EntityComponentMetadataStore {
  metadata: Record<string, CacheEntry>;  // key: 'project:entityDataTable'
  setComponentMetadata: (entityCode: string, componentName: string, metadata: ComponentMetadata) => void;
  getComponentMetadata: (entityCode: string, componentName: string) => ComponentMetadata | null;
}
```

#### Short-Lived Stores (5 min TTL + URL-bound)

```typescript
// 5. EntitySpecificInstanceDataStore - Single entity (URL: /entity/:id)
interface EntityInstanceDataStore {
  instances: Record<string, CacheEntry>;  // key: 'project:uuid-123'
  setInstance: (entityCode: string, instanceId: string, data: EntityInstance) => void;
  getInstance: (entityCode: string, instanceId: string) => EntityInstance | null;
  isDirty: (entityCode: string, instanceId: string) => boolean;  // Optimistic update tracking
}

// 6. EntityListOfInstancesDataStore - List data (URL: /entity?params)
interface EntityInstanceListDataStore {
  lists: Record<string, CacheEntry>;  // key: 'project:page=1&limit=20'
  setList: (entityCode: string, queryHash: string, data: ListData) => void;
  getList: (entityCode: string, queryHash: string) => ListData | null;
}
```

#### Other Stores (Memory)

```typescript
// 7. useEntityEditStore - Edit state management
interface EntityEditStore {
  originalData: Record<string, any> | null;
  currentData: Record<string, any> | null;
  dirtyFields: Set<string>;
  undoStack: EditAction[];
  redoStack: EditAction[];
  getChanges: () => Record<string, any>;  // Only changed fields for PATCH
}

// 8. useEntityStore - Monolithic entity state (alternative pattern)
interface EntityStore {
  entities: Record<string, any[]>;         // All entities by type
  selectedEntity: any | null;              // Currently selected
  loading: boolean;
  error: string | null;
  fetchEntities: (entityCode: string) => Promise<void>;
  setSelectedEntity: (entity: any) => void;
}

// 9. uiStateStore - UI preferences and state
interface UIStateStore {
  sidebarCollapsed: boolean;               // Sidebar visibility
  viewMode: 'table' | 'kanban' | 'calendar' | 'grid';  // Current view
  theme: 'light' | 'dark' | 'system';      // Theme preference
  toggleSidebar: () => void;
  setViewMode: (mode: ViewMode) => void;
}
```

### URL-Bound Cache Management

```typescript
// Navigation to /office (list view)
navigateToEntity('office') → {
  1. Check URL change (previous URL vs current URL)
  2. If URL changed → INVALIDATE previous entity's URL-bound caches
  3. Check EntityListOfInstancesDataStore for cached list
  4. If expired (>5 min) or not found → Fetch fresh data
  5. Store in EntityListOfInstancesDataStore with URL as key
}

// Navigation to /office/123 (detail view)
navigateToEntityDetail('office', '123') → {
  1. INVALIDATE EntityListOfInstancesDataStore (left /office URL)
  2. Check EntitySpecificInstanceDataStore for cached instance
  3. If expired (>5 min) or not found → Fetch fresh data
  4. Store in EntitySpecificInstanceDataStore with 'office:123' as key
}

// Navigation away from /office/123 to /project
navigateToEntity('project') → {
  1. INVALIDATE EntitySpecificInstanceDataStore (left /office/123 URL)
  2. Keep all 30-min session caches ✓
  3. Fetch project list → EntityListOfInstancesDataStore
}

// Exit from /settings
exitSettings() → {
  1. INVALIDATE entityCodeMetadataStore
  2. INVALIDATE datalabelMetadataStore
  3. INVALIDATE globalSettingsMetadataStore
  4. INVALIDATE entityComponentMetadataStore
  5. Trigger immediate refetch for current page
}
```

### Cache Decision Tree

```
Need Data?
    ↓
Which store type?
    ├─ Session-level (30 min TTL)?
    │   └─ Check store → If expired or missing → Fetch → Cache
    │
    └─ URL-bound (5 min TTL)?
        └─ Is current URL = cache URL?
            ├─ No → INVALIDATE → Fetch → Cache with new URL
            └─ Yes → Is TTL expired (>5 min)?
                ├─ Yes → Fetch → Update cache
                └─ No → Return cached data
```

### Benefits

- **70% Reduction in API Calls**: Session-level caches (30 min) for metadata
- **Instant Navigation**: Cached sidebar and component metadata
- **Dedicated Datalabel Endpoint**: `GET /api/v1/datalabel?name=<name>` with 30-min session cache
- **Dedicated GlobalSettings Endpoint**: `GET /api/v1/settings/global` with 30-min session cache
- **Fresh Data Guarantee**: URL-bound caches ensure current data on navigation
- **Smart Invalidation**: Settings exit triggers full session cache refresh
- **Memory Efficient**: Automatic cleanup on URL navigation
- **Optimistic Updates**: `isDirty` flag enables immediate UI feedback

---

*Architecture documented: 2025-01-21*
*Version: 3.0.0* - Updated to 7-store architecture with URL-bound caching