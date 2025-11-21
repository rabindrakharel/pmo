# Data Flow Architecture

## System Overview

The PMO platform implements a **unidirectional data flow** pattern where data flows from the backend API through route components to presentation components. This architecture ensures predictable state updates, eliminates data synchronization issues, and optimizes performance through preloading.

## Data Flow Diagram

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
│  • Entity Infrastructure Service (RBAC, relationships)             │
│  • Backend Formatter Service (metadata generation)                 │
│  • Includes datalabels, metadata in responses                     │
└────────────────────┬───────────────────────────────────────────────┘
                     │ HTTP/JSON
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Route Components (Pages)                       │
│  • EntityMainPage, EntityDetailPage, EntityFormPage               │
│  • Single data fetch on mount                                     │
│  • Distributes preloaded data to children                         │
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
      const res = await fetch('/api/v1/business?include=metadata,datalabels');
      return res.json();
    }
  );

  /* Response structure:
  {
    data: Business[],
    metadata: {
      entity: 'business',
      fields: BackendFieldMetadata[]
    },
    datalabels: [
      { name: 'dl__business_stage', options: DatalabelOption[] }
    ],
    total: number,
    limit: number,
    offset: number
  }
  */

  return (
    <EntityMainPage
      entityType="business"
      data={response?.data}
      metadata={response?.metadata}
      datalabels={response?.datalabels}
    />
  );
}

// STEP 2: EntityMainPage renders table
// ========================================
// Location: apps/web/src/pages/entity/EntityMainPage.tsx

function EntityMainPage({ entityType, data, metadata, datalabels }) {
  const navigate = useNavigate();

  const handleRowClick = (item: any) => {
    // Navigate to detail view
    navigate(`/${entityType}/${item.id}`);
  };

  return (
    <EntityDataTable
      data={data}
      columns={generateColumnsFromMetadata(metadata)}
      datalabels={datalabels}  // Pass preloaded datalabels
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
      const res = await fetch(`/api/v1/business/${id}?include=all`);
      return res.json();
    }
  );

  /* Enhanced response includes:
  {
    data: {
      ...businessFields,
      _children: {
        projects: Project[],
        offices: Office[]
      }
    },
    metadata: BackendMetadata,
    datalabels: DatalabelData[],
    permissions: Permission[]
  }
  */

  return (
    <EntityDetailPage
      entityType="business"
      data={response?.data}
      metadata={response?.metadata}
      datalabels={response?.datalabels}
    />
  );
}

// STEP 4: EntityDetailPage renders details and tabs
// ========================================
// Location: apps/web/src/pages/entity/EntityDetailPage.tsx

function EntityDetailPage({ entityType, data, metadata, datalabels }) {
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
            datalabels={datalabels}  // Preloaded, no API calls
            isEditing={isEditing}
            onChange={handleFieldChange}
          />
        </Tab>

        <Tab value="projects">
          <EntityDataTable
            data={data._children.projects}
            metadata={metadata.children.project}
            datalabels={datalabels}  // Reuse parent datalabels
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

  // Include datalabels for dropdown fields
  const datalabelKeys = extractDatalabelKeys(metadata);
  const datalabels = await fetchDatalabels(db, datalabelKeys);

  return {
    data: business,
    metadata,
    datalabels
  };
});

// STEP 2: EntityFormContainer processes metadata
// ========================================
// Location: apps/web/src/components/shared/entity/EntityFormContainer.tsx

function EntityFormContainer({ data, metadata, datalabels }) {
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

  // Build options for select fields
  const { settingOptions, dagNodes } = useMemo(() => {
    const options = new Map();
    const nodes = new Map();

    fields.forEach(field => {
      if (field.loadFromDataLabels) {
        const datalabel = datalabels.find(
          dl => dl.name === field.datalabelKey
        );
        if (datalabel) {
          options.set(field.key, datalabel.options);
          if (isStageField(field.key)) {
            nodes.set(field.key, transformToDAGNodes(datalabel.options));
          }
        }
      }
    });

    return { settingOptions: options, dagNodes: nodes };
  }, [fields, datalabels]);

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
    WHERE entity_type = 'project'
  `);

  // Fetch children if requested
  if (request.query.include === 'all') {
    project._children = {
      tasks: await getChildEntities('task', project.id),
      artifacts: await getChildEntities('artifact', project.id)
    };
  }

  return {
    data: project,
    childEntityCodes: entityInfo.child_entity_codes,
    datalabels: await fetchDatalabels(db, extractKeys(project))
  };
});

// STEP 2: DynamicChildEntityTabs renders tabs
// ========================================
// Location: apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx

function DynamicChildEntityTabs({
  parentType,
  parentId,
  parentData,
  childEntityCodes,
  parentDatalabels  // Reuse parent's datalabels
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
            datalabels={parentDatalabels}  // Reuse parent datalabels
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
    console.log('Has datalabels:', !!props.datalabels);
    console.log('Datalabel count:', props.datalabels?.length || 0);
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

---

*Architecture documented: 2025-01-21*
*Version: 1.0.0*