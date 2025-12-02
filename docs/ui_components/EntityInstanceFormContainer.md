# EntityInstanceFormContainer Component

**Version:** 9.7.0 | **Location:** `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`

> **Note:** As of v9.7.0, metadata and data are fetched separately (two-query architecture). This applies to both parent entity detail pages AND child entity tabs. The page fetches metadata via `useEntityInstanceMetadata()` and constructs the expected structure before passing to components.

---

## Architectural Truth (v9.7.0)

**Two-Query Architecture for Detail Pages:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EntitySpecificInstancePage (v9.7.0)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  QUERY 1: DATA                           QUERY 2: METADATA                   │
│  ────────────────                        ─────────────────                   │
│  useEntity(entityCode, id)               useEntityInstanceMetadata(          │
│  └── Returns: { data, refData }            entityCode,                       │
│  └── Cache: 5 min                          'entityInstanceFormContainer'     │
│                                          )                                   │
│                                          └── Returns: { viewType, editType } │
│                                          └── Cache: 30 min                   │
│                                                                              │
│  PAGE CONSTRUCTS:                                                            │
│  ─────────────────                                                           │
│  backendMetadata = {                                                         │
│    entityInstanceFormContainer: {        ◄── Component expects THIS          │
│      viewType: formViewType,                                                 │
│      editType: formEditType                                                  │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  formatMetadata = {                      ◄── formatRow expects THIS          │
│    viewType: formViewType,                                                   │
│    editType: formEditType                                                    │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Entity List Data Flow (v9.7.0) - Main vs Child Entity Tabs

**Two-Query Architecture applies to BOTH main entity lists AND child entity tabs:**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    ENTITY LIST DATA FLOW (v9.7.0)                                    │
│                    Two-Query Architecture + Parent Filtering                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  CASE 1: MAIN ENTITY LIST (/task)                                                   │
│  ════════════════════════════════                                                   │
│                                                                                      │
│  ┌─────────────────────┐                                                            │
│  │ EntityListOfInstancesPage        │                                               │
│  │ entityCode = 'task' │                                                            │
│  └──────────┬──────────┘                                                            │
│             │                                                                        │
│             ├──────────────────────────────────────────────────────────────────┐    │
│             │                                                                  │    │
│             ▼                                                                  ▼    │
│  ┌──────────────────────────────┐                    ┌─────────────────────────────┐│
│  │ useEntityInstanceData('task')│                    │ useEntityInstanceMetadata   ││
│  │ params: { limit, offset }    │                    │ ('task', 'entityListOf...') ││
│  └──────────────┬───────────────┘                    └──────────────┬──────────────┘│
│                 │                                                   │               │
│                 ▼                                                   ▼               │
│  ┌──────────────────────────────┐                    ┌─────────────────────────────┐│
│  │ GET /api/v1/task?limit=100   │                    │ GET /api/v1/task            ││
│  │                              │                    │     ?content=metadata       ││
│  │ Returns:                     │                    │                             ││
│  │ { data: [...], metadata: {} }│                    │ Returns:                    ││
│  │                              │                    │ { metadata: {               ││
│  │ Cache: 5-min staleTime       │                    │   entityListOfInstancesTable: {     ││
│  └──────────────┬───────────────┘                    │     viewType: {...},        ││
│                 │                                    │     editType: {...}         ││
│                 │                                    │   }                         ││
│                 │                                    │ }}                          ││
│                 │                                    │                             ││
│                 │                                    │ Cache: 30-min staleTime     ││
│                 │                                    └──────────────┬──────────────┘│
│                 │                                                   │               │
│                 └───────────────────┬───────────────────────────────┘               │
│                                     │                                               │
│                                     ▼                                               │
│                      ┌──────────────────────────────┐                               │
│                      │ Page constructs metadata:    │                               │
│                      │ const metadata = useMemo(() =>│                              │
│                      │   ({ viewType, editType })   │                               │
│                      │ , [viewType, editType]);     │                               │
│                      └──────────────┬───────────────┘                               │
│                                     │                                               │
│                                     ▼                                               │
│                      ┌──────────────────────────────┐                               │
│                      │ <EntityListOfInstancesTable  │                               │
│                      │   data={data}                │                               │
│                      │   metadata={metadata}        │                               │
│                      │   ref_data_entityInstance={} │                               │
│                      │ />                           │                               │
│                      └──────────────────────────────┘                               │
│                                                                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  CASE 2: CHILD ENTITY TAB (/project/:id/task)                                       │
│  ════════════════════════════════════════════                                       │
│                                                                                      │
│  ┌─────────────────────────────────────┐                                            │
│  │ EntitySpecificInstancePage          │                                            │
│  │ entityCode = 'project'              │                                            │
│  │ id = '61203bac-...'                 │                                            │
│  │ currentChildEntity = 'task'         │ ◄── From URL: /project/:id/task            │
│  └──────────────┬──────────────────────┘                                            │
│                 │                                                                    │
│                 │  shouldFetchChildData = true (on child tab)                       │
│                 │                                                                    │
│                 ├──────────────────────────────────────────────────────────────┐    │
│                 │                                                              │    │
│                 ▼                                                              ▼    │
│  ┌──────────────────────────────────────┐          ┌─────────────────────────────┐ │
│  │ useEntityInstanceData('task', {      │          │ useEntityInstanceMetadata   │ │
│  │   parent_entity_code: 'project',     │          │ ('task', 'entityListOf...') │ │
│  │   parent_entity_instance_id: '...',  │          │                             │ │
│  │   limit: 100                         │          │ ◄── Same as CASE 1!         │ │
│  │ })                                   │          │     Metadata is entity-type │ │
│  └──────────────┬───────────────────────┘          │     level, not parent-      │ │
│                 │                                  │     dependent               │ │
│                 ▼                                  └──────────────┬──────────────┘ │
│  ┌──────────────────────────────────────┐                        │                 │
│  │ GET /api/v1/task                     │                        │                 │
│  │   ?parent_entity_code=project        │                        │                 │
│  │   &parent_entity_instance_id=...     │                        │                 │
│  │   &limit=100                         │                        │                 │
│  │                                      │                        │                 │
│  │ Backend (task/routes.ts):            │                        │                 │
│  │ ┌────────────────────────────────┐   │                        │                 │
│  │ │ if (parent_entity_code &&      │   │                        │                 │
│  │ │     parent_entity_instance_id) │   │                        │                 │
│  │ │   joins.push(sql`              │   │                        │                 │
│  │ │     INNER JOIN                 │   │                        │                 │
│  │ │       entity_instance_link eil │   │                        │                 │
│  │ │     ON eil.child_entity_code   │   │                        │                 │
│  │ │        = 'task'                │   │                        │                 │
│  │ │     AND eil.entity_code        │   │                        │                 │
│  │ │        = 'project'             │   │                        │                 │
│  │ │     AND eil.entity_instance_id │   │                        │                 │
│  │ │        = :parentId             │   │                        │                 │
│  │ │   `);                          │   │                        │                 │
│  │ └────────────────────────────────┘   │                        │                 │
│  │                                      │                        │                 │
│  │ Returns: { data: [filtered], ... }   │                        │                 │
│  └──────────────┬───────────────────────┘                        │                 │
│                 │                                                │                 │
│                 └────────────────────┬───────────────────────────┘                 │
│                                      │                                             │
│                                      ▼                                             │
│                       ┌──────────────────────────────┐                             │
│                       │ const childMetadata = useMemo│                             │
│                       │   (() => ({                  │                             │
│                       │     viewType: childViewType, │                             │
│                       │     editType: childEditType  │                             │
│                       │   }), [...]);                │                             │
│                       └──────────────┬───────────────┘                             │
│                                      │                                             │
│                                      ▼                                             │
│                       ┌──────────────────────────────┐                             │
│                       │ <EntityListOfInstancesTable  │                             │
│                       │   data={childData}           │                             │
│                       │   metadata={childMetadata}   │                             │
│                       │   loading={childLoading ||   │                             │
│                       │           childMetadataLoading}│                           │
│                       │ />                           │                             │
│                       └──────────────────────────────┘                             │
│                                                                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  KEY INSIGHT: SAME METADATA, DIFFERENT DATA FILTERING                               │
│  ════════════════════════════════════════════════════                               │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                │ │
│  │   METADATA QUERY (both cases):                                                 │ │
│  │   ─────────────────────────────                                                │ │
│  │   GET /api/v1/task?content=metadata                                            │ │
│  │   → Returns viewType/editType for ALL task fields                              │ │
│  │   → 30-min cache (entity-type level, not instance-dependent)                   │ │
│  │                                                                                │ │
│  │   DATA QUERY (differs by context):                                             │ │
│  │   ──────────────────────────────                                               │ │
│  │                                                                                │ │
│  │   CASE 1: GET /api/v1/task?limit=100                                           │ │
│  │           → Returns ALL tasks user can see (RBAC filtered)                     │ │
│  │                                                                                │ │
│  │   CASE 2: GET /api/v1/task?parent_entity_code=project                          │ │
│  │                          &parent_entity_instance_id=uuid                       │ │
│  │                          &limit=100                                            │ │
│  │           → Returns ONLY tasks linked to that specific project                 │ │
│  │           → Uses INNER JOIN with entity_instance_link                          │ │
│  │                                                                                │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  CACHE KEY STRUCTURE                                                                │
│  ═══════════════════                                                                │
│                                                                                      │
│  TanStack Query Keys:                                                               │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                │ │
│  │  Metadata (shared):                                                            │ │
│  │  ['entityInstanceMetadata', 'task', 'entityListOfInstancesTable']              │ │
│  │                                                                                │ │
│  │  Data (CASE 1 - no parent):                                                    │ │
│  │  ['entityInstanceData', 'task', { limit: 100, offset: 0 }]                     │ │
│  │                                                                                │ │
│  │  Data (CASE 2 - with parent):                                                  │ │
│  │  ['entityInstanceData', 'task', {                                              │ │
│  │    limit: 100,                                                                 │ │
│  │    offset: 0,                                                                  │ │
│  │    parent_entity_code: 'project',                                              │ │
│  │    parent_entity_instance_id: '61203bac-...'                                   │ │
│  │  }]                                                                            │ │
│  │                                                                                │ │
│  │  ▲ Different cache keys = independent caches                                   │ │
│  │  ▲ Metadata shared between both views (same columns)                           │ │
│  │                                                                                │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**File References:**

| Component | File | Lines |
|-----------|------|-------|
| Main entity list page | `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` | - |
| Child entity data hook | `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx` | 284-296 |
| Child entity metadata hook | `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx` | 298-314 |
| API URL construction | `apps/web/src/db/cache/hooks/useEntityInstanceData.ts` | 181-196 |
| Backend parent filtering | `apps/api/src/modules/task/routes.ts` | 290-301 |
| Metadata-only API | `apps/api/src/modules/task/routes.ts` | 356-397 |

---

**Metadata properties control datalabel field rendering:**

| Metadata | Property | Purpose |
|----------|----------|---------|
| **viewType** | `renderType` + `component` | Controls WHICH component renders (view mode) |
| **editType** | `inputType` + `component` | Controls WHICH component renders (edit mode) |
| **editType** | `lookupSource` + `datalabelKey` | Controls WHERE data comes from |

---

## Props Interface (v9.6.0)

```typescript
import type { FormattedRow } from '@/lib/formatters';

interface EntityInstanceFormContainerProps {
  /** Entity configuration (optional - can derive from metadata) */
  config?: EntityConfig;

  /** Entity data (can be raw or FormattedRow) */
  data: Record<string, any>;

  /** Is form in edit mode? */
  isEditing: boolean;

  /** Field change handler */
  onChange: (fieldKey: string, value: any) => void;

  /** Form mode */
  mode?: 'create' | 'edit';

  /**
   * Backend-generated metadata (REQUIRED)
   * MUST be wrapped: { entityInstanceFormContainer: { viewType, editType } }
   * Component accesses: metadata?.entityInstanceFormContainer
   */
  metadata?: EntityMetadata;

  /** Datalabel options (from getDatalabelSync) */
  datalabels?: DatalabelData[];

  /** Pre-formatted data from format-at-read (optional) */
  formattedData?: FormattedRow<Record<string, any>>;

  // v11.0.0: ref_data_entityInstance removed - uses TanStack Query cache via getEntityInstanceNameSync()
}

// EntityMetadata structure the component expects
interface EntityMetadata {
  entityInstanceFormContainer: ComponentMetadata;  // ◄── REQUIRED wrapper key
}

// ComponentMetadata structure
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}
```

---

## Data Flow (v9.6.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETAIL PAGE DATA FLOW (v9.6.0)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EntitySpecificInstancePage                                                  │
│  ─────────────────────────────                                              │
│                                                                              │
│  // QUERY 1: Entity data                                                     │
│  const { data: rawData, refData } = useEntity(entityCode, id);              │
│                                                                              │
│  // QUERY 2: Form metadata (30-min cache)                                    │
│  const { viewType: formViewType, editType: formEditType } =                 │
│    useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer');    │
│                                                                              │
│  // Construct wrapped metadata for component                                 │
│  const backendMetadata = useMemo(() => ({                                   │
│    entityInstanceFormContainer: {                                            │
│      viewType: formViewType,                                                 │
│      editType: formEditType                                                  │
│    }                                                                         │
│  }), [formViewType, formEditType]);                                         │
│                                                                              │
│  // Construct flat metadata for formatRow                                    │
│  const formatMetadata = useMemo(() => ({                                    │
│    viewType: formViewType,                                                   │
│    editType: formEditType                                                    │
│  }), [formViewType, formEditType]);                                         │
│                                                                              │
│  // Format data on read                                                      │
│  const formattedData = useMemo(() =>                                        │
│    formatRow(rawData, formatMetadata, refData)                              │
│  , [rawData, formatMetadata, refData]);                                     │
│                                                                              │
│  return (                                                                     │
│    <EntityInstanceFormContainer                                              │
│      data={isEditing ? editedData : rawData}                                │
│      metadata={backendMetadata}          ◄── Wrapped structure               │
│      formattedData={formattedData}                                          │
│      ref_data_entityInstance={refData}                                      │
│      isEditing={isEditing}                                                  │
│      onChange={handleChange}                                                 │
│    />                                                                        │
│  );                                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    EntityInstanceFormContainer                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  // Extract component-specific metadata                                      │
│  const componentMetadata = metadata?.entityInstanceFormContainer;           │
│                                                                              │
│  // Generate fields from viewType                                            │
│  const viewType = extractViewType(componentMetadata);                       │
│  const editType = extractEditType(componentMetadata);                       │
│                                                                              │
│  const fields = Object.entries(viewType)                                    │
│    .filter(([_, meta]) => meta.behavior?.visible !== false)                 │
│    .map(([key, viewMeta]) => ({                                             │
│      key,                                                                    │
│      label: viewMeta.label,                                                  │
│      renderType: viewMeta.renderType,                                        │
│      inputType: editType?.[key]?.inputType ?? 'text',                       │
│      lookupSource: editType?.[key]?.lookupSource,                           │
│      // ... other field properties                                           │
│    }));                                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Metadata Types

### ViewFieldMetadata

```typescript
interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'boolean', 'component', etc.
  component?: string;     // Component name when renderType='component' (e.g., 'DAGVisualizer')
  behavior: {
    visible?: boolean;    // Show in form
  };
  style: Record<string, any>;
  datalabelKey?: string;  // For badge fields
  lookupEntity?: string;  // For entity reference fields
}
```

### EditFieldMetadata

```typescript
interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;      // 'text', 'number', 'select', 'date', 'checkbox', 'textarea', etc.
  behavior: {
    editable?: boolean;   // Allow editing
  };
  validation: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  lookupSource?: 'datalabel' | 'entityInstance';
  datalabelKey?: string;    // For datalabel select fields
  lookupEntity?: string;    // For entity reference fields
}
```

---

## Field Type Mapping

| viewType.renderType | viewType.component | View Display | editType.inputType | Edit Component |
|---------------------|--------------------|--------------|--------------------|----------------|
| `currency` | - | `$50,000.00` | `number` | `<DebouncedInput type="number">` |
| `badge` | - | Badge with color | `select` | `<BadgeDropdownSelect>` |
| `component` | `DAGVisualizer` | DAGVisualizer graph | `select` | Interactive `<DAGVisualizer>` or `<BadgeDropdownSelect>` |
| `date` | - | `Jan 15, 2025` | `date` | `<input type="date">` |
| `boolean` | - | Check/X icon | `checkbox` | `<input type="checkbox">` |
| `entityInstanceId` | - | Entity name (via ref_data) | `entityInstanceId` | `<EntityInstanceNameLookup>` |
| `text` | - | Plain text | `text` | `<DebouncedInput type="text">` |
| `textarea` | - | Multi-line text | `textarea` | `<DebouncedTextarea>` |
| `jsonb` | `MetadataTable` | JSON viewer | `jsonb` | `<MetadataTable isEditing={true}>` |
| `array` | - | Badge list | `array` | `<DebouncedInput>` (comma-separated) |
| `timestamp` | - | Relative time | `timestamp` | Read-only display |

---

## Entity Reference Handling

### ref_data_entityInstance Pattern

```typescript
// Backend sends:
{
  data: {
    manager__employee_id: 'uuid-123',
    stakeholder__employee_ids: ['uuid-1', 'uuid-2']
  },
  ref_data_entityInstance: {
    employee: {
      'uuid-123': 'John Smith',
      'uuid-1': 'Alice',
      'uuid-2': 'Bob'
    }
  }
}

// v11.0.0: Component uses TanStack Query cache via getEntityInstanceNameSync()
import { getEntityInstanceNameSync } from '@/db';

const resolvedName = getEntityInstanceNameSync('employee', 'uuid-123'); // → 'John Smith'
```

---

## Usage Example (v9.6.0)

```typescript
import { useEntity, useEntityInstanceMetadata } from '@/db/tanstack-index';
import { EntityInstanceFormContainer } from '@/components/shared/entity/EntityInstanceFormContainer';
import { formatRow } from '@/lib/formatters';

function ProjectDetailPage({ projectId }) {
  // QUERY 1: Entity data (5-min cache)
  const { data: rawData, refData, isLoading } = useEntity('project', projectId);

  // QUERY 2: Form metadata (30-min cache)
  const {
    viewType: formViewType,
    editType: formEditType,
    isLoading: metadataLoading,
  } = useEntityInstanceMetadata('project', 'entityInstanceFormContainer');

  // Construct wrapped metadata for component
  const backendMetadata = useMemo(() => {
    if (!formViewType || Object.keys(formViewType).length === 0) return null;
    return {
      entityInstanceFormContainer: { viewType: formViewType, editType: formEditType }
    };
  }, [formViewType, formEditType]);

  // Construct flat metadata for formatRow
  const formatMetadata = useMemo(() => {
    if (!formViewType || Object.keys(formViewType).length === 0) return null;
    return { viewType: formViewType, editType: formEditType };
  }, [formViewType, formEditType]);

  // Format data on read
  const formattedData = useMemo(() => {
    if (!rawData) return null;
    return formatRow(rawData, formatMetadata, refData);
  }, [rawData, formatMetadata, refData]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(rawData);

  const handleChange = (fieldKey: string, value: any) => {
    setEditedData(prev => ({ ...prev, [fieldKey]: value }));
  };

  if (isLoading || metadataLoading) return <Skeleton />;

  return (
    <EntityInstanceFormContainer
      data={isEditing ? editedData : rawData}
      metadata={backendMetadata}
      formattedData={isEditing ? undefined : formattedData}
      ref_data_entityInstance={refData}
      isEditing={isEditing}
      onChange={handleChange}
    />
  );
}
```

---

## Critical Considerations

### Design Principles (v9.6.0)

1. **Two-Query Architecture** - Metadata cached separately (30-min) from data (5-min)
2. **Wrapped Metadata** - Component expects `{ entityInstanceFormContainer: { viewType, editType } }`
3. **Format-at-Read** - Page formats data via `formatRow()` before passing to component
4. **Backend Required** - Metadata must be fetched via `useEntityInstanceMetadata`
5. **Datalabel Store** - Use `getDatalabelSync()` for dropdown options

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Passing flat `{ viewType, editType }` to component | Wrap as `{ entityInstanceFormContainer: { viewType, editType } }` |
| Expecting metadata from `useEntity` response | Use separate `useEntityInstanceMetadata` hook |
| Direct `metadata.viewType` access | Use `extractViewType(metadata?.entityInstanceFormContainer)` |
| Frontend pattern detection (e.g., `_id` suffix) | Backend sends `lookupEntity` in metadata |
| Hardcoded field list | Use `viewType` from backend |
| Using `_ID`/`_IDS` embedded objects | Use `ref_data_entityInstance` lookup table |

---

## Memoization Strategy

The component uses `React.memo` with a custom `arePropsEqual` function to prevent unnecessary re-renders during editing:

```typescript
function arePropsEqual(prevProps, nextProps): boolean {
  // Re-render triggers:
  // - isEditing changes
  // - mode changes
  // - metadata changes (structure)
  // - config changes
  // - datalabels changes
  // - ref_data_entityInstance changes
  // - data KEYS change (not values during editing)

  // Does NOT trigger re-render:
  // - onChange function reference changes (captured in useCallback)
  // - data VALUES change during editing (handled by local state)

  return true; // if none of the above changed
}

export const EntityInstanceFormContainer = React.memo(EntityInstanceFormContainerInner, arePropsEqual);
```

---

**Last Updated:** 2025-12-01 | **Version:** 9.6.0 | **Status:** Production Ready

**Recent Updates:**
- v9.6.0 (2025-12-01): **Two-Query Architecture**
  - Metadata fetched separately via `useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer')`
  - Page constructs wrapped metadata: `{ entityInstanceFormContainer: { viewType, editType } }`
  - Page constructs flat metadata for `formatRow()`: `{ viewType, editType }`
  - Fixed metadata structure mismatch between hook return and component expectation
  - Updated data flow documentation
- v8.3.2 (2025-11-27): **Component-Driven Rendering Architecture**
  - viewType controls WHICH component renders (`renderType: 'component'` + `component`)
  - editType controls WHERE data comes from (`lookupSource: 'datalabel'` + `datalabelKey`)
- v8.3.0 (2025-11-26): **ref_data_entityInstance Pattern**
  - Added `ref_data_entityInstance?: RefData` prop for entity reference resolution
  - Deprecated `_ID`/`_IDS` embedded object pattern
