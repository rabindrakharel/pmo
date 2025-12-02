# EntityInstanceFormContainer Component

**Version:** 11.1.0 | **Location:** `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`

> **Note:** As of v11.1.0, both `EntityInstanceFormContainer` and `EntityListOfInstancesTable` use the same **flat metadata format**: `{ viewType, editType }`. This matches the pattern used by the list page. The component supports both flat and nested formats for backward compatibility, but flat format is the standard.

---

## Architectural Truth (v11.1.0)

**Two-Query Architecture with Flat Metadata Format:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EntitySpecificInstancePage (v11.1.0)                                        │
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
│  PAGE CONSTRUCTS (v11.1.0 - FLAT FORMAT):                                   │
│  ─────────────────────────────────────────                                  │
│  formMetadata = {                        ◄── SAME format as EntityListOfInstancesTable  │
│    viewType: formViewType,                                                   │
│    editType: formEditType                                                    │
│  }                                                                           │
│                                                                              │
│  // Both formatRow AND component receive the SAME flat structure             │
│  // v11.1.0: Component supports BOTH flat and nested for compatibility       │
│                                                                              │
│  CACHE ACCESS (v11.0.0):                                                     │
│  ─────────────────────────                                                   │
│  • Entity reference resolution: getEntityInstanceNameSync(entityCode, uuid)  │
│  • Reads directly from queryClient.getQueryData()                            │
│  • No separate sync stores - TanStack Query is single source of truth        │
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
| **editType** | `lookupSourceTable` + `lookupField` | Controls WHERE data comes from (v12.0.0) |

---

## Props Interface (v11.1.0)

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
   * v11.1.0: Accepts FLAT format { viewType, editType } (preferred)
   * Also supports nested format for backward compatibility
   */
  metadata?: EntityMetadata;

  /** Datalabel options (from getDatalabelSync) */
  datalabels?: DatalabelData[];

  /** Pre-formatted data from format-at-read (optional) */
  formattedData?: FormattedRow<Record<string, any>>;

  // v11.0.0: ref_data_entityInstance removed - uses TanStack Query cache via getEntityInstanceNameSync()
}

// v11.1.0: Component supports BOTH formats
// PREFERRED: Flat format (same as EntityListOfInstancesTable)
interface FlatMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

// SUPPORTED: Nested format (backward compatible)
interface NestedMetadata {
  entityInstanceFormContainer: {
    viewType: Record<string, ViewFieldMetadata>;
    editType: Record<string, EditFieldMetadata>;
  };
}

type EntityMetadata = FlatMetadata | NestedMetadata;

// ComponentMetadata structure
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}
```

---

## Data Flow (v11.1.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETAIL PAGE DATA FLOW (v11.1.0)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EntitySpecificInstancePage                                                  │
│  ─────────────────────────────                                              │
│                                                                              │
│  // QUERY 1: Entity data (5-min cache)                                       │
│  const { data: rawData, refData } = useEntity(entityCode, id);              │
│                                                                              │
│  // QUERY 2: Form metadata (30-min cache)                                    │
│  const { viewType: formViewType, editType: formEditType } =                 │
│    useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer');    │
│                                                                              │
│  // v11.1.0: Use FLAT metadata format (same as EntityListOfInstancesTable)  │
│  const formMetadata = useMemo(() => ({                                      │
│    viewType: formViewType,                                                   │
│    editType: formEditType                                                    │
│  }), [formViewType, formEditType]);                                         │
│                                                                              │
│  // Format data on read (formMetadata used for BOTH formatting AND component)│
│  const formattedData = useMemo(() =>                                        │
│    formatRow(rawData, formMetadata, refData)                                │
│  , [rawData, formMetadata, refData]);                                       │
│                                                                              │
│  return (                                                                     │
│    <EntityInstanceFormContainer                                              │
│      data={isEditing ? editedData : rawData}                                │
│      metadata={formMetadata}             ◄── FLAT format (v11.1.0)          │
│      formattedData={formattedData}                                          │
│      isEditing={isEditing}                                                  │
│      onChange={handleChange}                                                 │
│    />                                                                        │
│  );                                                                          │
│  // NOTE: ref_data_entityInstance no longer passed as prop                   │
│  // Component uses getEntityInstanceNameSync() from TanStack Query cache     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    EntityInstanceFormContainer (v11.1.0)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  // v11.1.0: Support both flat and nested metadata formats                   │
│  const componentMetadata = (metadata as any)?.viewType                       │
│    ? metadata                                    // Flat format              │
│    : (metadata as any)?.entityInstanceFormContainer;  // Nested format       │
│                                                                              │
│  // Generate fields from viewType                                            │
│  const viewType = componentMetadata?.viewType ?? {};                         │
│  const editType = componentMetadata?.editType ?? {};                         │
│                                                                              │
│  const fields = Object.entries(viewType)                                    │
│    .filter(([_, meta]) => meta.behavior?.visible !== false)                 │
│    .map(([key, viewMeta]) => {                                              │
│      const editMeta = editType[key];                                         │
│      // v11.1.0: lookupEntity from viewMeta (view) or editMeta (edit)        │
│      const lookupEntity = viewMeta?.lookupEntity || editMeta?.lookupEntity; │
│      return {                                                                │
│        key,                                                                  │
│        label: viewMeta.label,                                                │
│        renderType: viewMeta.renderType,                                      │
│        component: viewMeta.component,                                        │
│        inputType: editMeta?.inputType ?? 'text',                            │
│        lookupSourceTable: editMeta?.lookupSourceTable,                                 │
│        lookupEntity,  // For entity reference resolution                     │
│      };                                                                      │
│    });                                                                       │
│                                                                              │
│  // Entity reference resolution (v11.0.0):                                   │
│  // Uses getEntityInstanceNameSync(entityCode, uuid) which reads from        │
│  // queryClient.getQueryData() - no separate sync stores                     │
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
  lookupField?: string;  // For badge/datalabel fields (v12.0.0)
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
  lookupSourceTable?: 'datalabel' | 'entityInstance';  // v12.0.0
  lookupField?: string;    // For datalabel select fields (v12.0.0)
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

## Usage Example (v11.1.0)

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

  // v11.1.0: Use FLAT metadata format - same for formatRow AND component
  const formMetadata = useMemo(() => {
    if (!formViewType || Object.keys(formViewType).length === 0) return null;
    return { viewType: formViewType, editType: formEditType };
  }, [formViewType, formEditType]);

  // Format data on read
  const formattedData = useMemo(() => {
    if (!rawData) return null;
    return formatRow(rawData, formMetadata, refData);
  }, [rawData, formMetadata, refData]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(rawData);

  const handleChange = (fieldKey: string, value: any) => {
    setEditedData(prev => ({ ...prev, [fieldKey]: value }));
  };

  if (isLoading || metadataLoading) return <Skeleton />;

  return (
    <EntityInstanceFormContainer
      data={isEditing ? editedData : rawData}
      metadata={formMetadata}  // v11.1.0: Flat format { viewType, editType }
      formattedData={isEditing ? undefined : formattedData}
      isEditing={isEditing}
      onChange={handleChange}
    />
    // NOTE: ref_data_entityInstance no longer passed
    // Entity names resolved via getEntityInstanceNameSync() from TanStack Query cache
  );
}
```

---

## Critical Considerations

### Design Principles (v11.1.0)

1. **Two-Query Architecture** - Metadata cached separately (30-min) from data (5-min)
2. **Flat Metadata Format** - Both components accept `{ viewType, editType }` (v11.1.0)
3. **Format-at-Read** - Page formats data via `formatRow()` before passing to component
4. **Backend Required** - Metadata must be fetched via `useEntityInstanceMetadata`
5. **Datalabel Store** - Use `getDatalabelSync()` for dropdown options
6. **Single In-Memory Cache** - Entity names resolved via `getEntityInstanceNameSync()` from TanStack Query (v11.0.0)

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Passing nested `{ entityInstanceFormContainer: { viewType, editType } }` | v11.1.0: Use flat `{ viewType, editType }` format |
| Expecting metadata from `useEntity` response | Use separate `useEntityInstanceMetadata` hook |
| Frontend pattern detection (e.g., `_id` suffix) | Backend sends `lookupEntity` in metadata |
| Hardcoded field list | Use `viewType` from backend |
| Using `ref_data_entityInstance` prop | v11.0.0: Entity names resolved via `getEntityInstanceNameSync()` from TanStack Query cache |
| Creating separate sync stores | v11.0.0: TanStack Query cache is single source of truth |

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

**Last Updated:** 2025-12-02 | **Version:** 11.1.0 | **Status:** Production Ready

**Recent Updates:**
- v11.1.0 (2025-12-02): **Flat Metadata Format**
  - Both `EntityListOfInstancesTable` and `EntityInstanceFormContainer` now use flat `{ viewType, editType }` format
  - Component supports both flat and nested formats for backward compatibility
  - Entity reference fields resolved via `getEntityInstanceNameSync()` reading from TanStack Query cache
  - `lookupEntity` extracted from viewMeta first, then editMeta
  - Removed redundant `backendMetadata` vs `formatMetadata` - single `formMetadata` used for both
- v11.0.0 (2025-12-02): **Single In-Memory Cache**
  - Removed `ref_data_entityInstance` prop - entity names resolved via `getEntityInstanceNameSync()`
  - Sync accessors read from `queryClient.getQueryData()` - no separate Map-based stores
  - TanStack Query cache is single source of truth
- v9.6.0 (2025-12-01): **Two-Query Architecture**
  - Metadata fetched separately via `useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer')`
  - Page constructs metadata structures for component
  - Updated data flow documentation
- v8.3.2 (2025-11-27): **Component-Driven Rendering Architecture**
  - viewType controls WHICH component renders (`renderType: 'component'` + `component`)
  - editType controls WHERE data comes from (`lookupSourceTable: 'datalabel'` + `lookupField`)
- v8.3.0 (2025-11-26): **ref_data_entityInstance Pattern**
  - Added `ref_data_entityInstance?: RefData` prop for entity reference resolution
  - Deprecated `_ID`/`_IDS` embedded object pattern
