# Datalabel System - End-to-End Data Flow

**Version:** 8.6.0 | **Updated:** 2025-11-28

> **Note:** As of v8.6.0, datalabel data is cached in RxDB (IndexedDB) along with all other metadata. Access via `useRxDatalabel()` hook or `getDatalabelSync()` for non-hook contexts.

---

## Architectural Truth

**Metadata properties control datalabel field rendering:**

| Metadata | Property | Purpose |
|----------|----------|---------|
| **viewType** | `renderType` + `component` | Controls WHICH component renders (view mode) |
| **editType** | `inputType` + `component` | Controls WHICH component renders (edit mode) |
| **editType** | `lookupSource` + `datalabelKey` | Controls WHERE data comes from |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATALABEL FIELD RENDERING ARCHITECTURE (v8.3.2)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  viewType.dl__project_stage:                                                 │
│  ┌────────────────────────────────┐                                          │
│  │ renderType: "component"        │──┐                                       │
│  │ component: "DAGVisualizer"     │──┼──► viewVizContainer = "DAGVisualizer" │
│  └────────────────────────────────┘  │                                       │
│                                      │                                       │
│                                      ▼                                       │
│          EntityInstanceFormContainer_viz_container: {                                │
│            view: "DAGVisualizer"   ◄── VIEW mode switch                     │
│          }                                                                   │
│                                      │                                       │
│                                      ▼                                       │
│          if (vizContainer?.view === 'DAGVisualizer') {                       │
│            return <DAGVisualizer nodes={...} />                              │
│          }                                                                   │
│                                                                              │
│  editType.dl__project_stage:                                                 │
│  ┌────────────────────────────────┐                                          │
│  │ inputType: "component"         │──┐                                       │
│  │ component: "BadgeDropdownSelect"│──┼──► editVizContainer = "BadgeDropdownSelect"│
│  │ lookupSource: "datalabel"      │──┼──► Filter for loading datalabel options│
│  │ datalabelKey: "dl__project_stage"│──► Cache key for options               │
│  └────────────────────────────────┘                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema

```sql
-- Entity table stores the current stage value
app.project
├── id: UUID
├── dl__project_stage: VARCHAR ──────► "Execution" (stage name)
└── ...other fields

-- Datalabel table stores stage definitions + hierarchy
app.datalabel_project_stage
├── id: INTEGER
├── name: VARCHAR ──────────────────► "Execution"
├── parent_ids: INTEGER[] ──────────► [2] (Planning's ID)
├── color_code: VARCHAR ────────────► "green"
├── sort_order: INTEGER
└── active_flag: BOOLEAN
```

---

## Phase 2: Backend Metadata Generation

### Pattern Detection (pattern-mapping.yaml)

```yaml
# Specific patterns BEFORE generic
- { pattern: "dl__*_stage", fieldBusinessType: datalabel_dag }
- { pattern: "dl__*_state", fieldBusinessType: datalabel_dag }
- { pattern: "dl__*_status", fieldBusinessType: datalabel_dag }
- { pattern: "dl__*", fieldBusinessType: datalabel }
```

### YAML Configuration (view-type-mapping.yaml)

```yaml
datalabel_dag:
  dtype: str
  entityInstanceFormContainer:
    renderType: component          # ← Triggers component switch
    component: DAGVisualizer       # ← WHICH component to render
    style: { showHierarchy: true, interactive: false }
```

### YAML Configuration (edit-type-mapping.yaml)

```yaml
datalabel_dag:
  dtype: str
  lookupSource: datalabel          # ← WHERE data comes from
  entityInstanceFormContainer:
    inputType: component
    component: BadgeDropdownSelect
    behavior: { editable: true }
```

---

## Phase 3: API Response

```json
{
  "data": {
    "dl__project_stage": "Execution"
  },
  "metadata": {
    "entityInstanceFormContainer": {
      "viewType": {
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "component",
          "component": "DAGVisualizer",
          "behavior": { "visible": true }
        }
      },
      "editType": {
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "component",
          "component": "BadgeDropdownSelect",
          "lookupSource": "datalabel",
          "datalabelKey": "dl__project_stage",
          "behavior": { "editable": true }
        }
      }
    }
  }
}
```

---

## Phase 4: Login-Time Caching (v8.6.0 - RxDB)

```typescript
// AuthContext.tsx - On successful login
import { prefetchAllMetadata } from '@/db/rxdb';

// Prefetch ALL metadata into RxDB (IndexedDB) + sync cache
await prefetchAllMetadata();

// This populates:
// 1. RxDB metadata collection (persistent in IndexedDB)
// 2. Sync cache (in-memory for non-hook access)

// Access in components via hook:
const { options } = useRxDatalabel('project_stage');

// Access in formatters/utilities via sync cache:
const options = getDatalabelSync('project_stage');

// Cache structure (same as before):
{
  "dl__project_stage": [
    { id: 1, name: "Initiation", parent_ids: [], color_code: "gray" },
    { id: 2, name: "Planning", parent_ids: [1], color_code: "blue" },
    { id: 3, name: "Execution", parent_ids: [2], color_code: "green" },
    { id: 4, name: "Monitoring", parent_ids: [3], color_code: "yellow" },
    { id: 5, name: "Closed", parent_ids: [4], color_code: "gray" }
  ]
}
```

---

## Phase 5: Frontend Rendering

### EntityInstanceFormContainer Field Building (lines 155-191)

```typescript
const fields = useMemo(() => {
  return Object.entries(viewType).map(([fieldKey, viewMeta]) => {
    const editMeta = editType?.[fieldKey];

    // viewType controls WHICH component renders
    const viewVizContainer = (viewMeta.renderType === 'component' && viewMeta.component)
      ? viewMeta.component    // "DAGVisualizer"
      : undefined;

    // editType controls WHERE data comes from
    const lookupSource = editMeta?.lookupSource;     // "datalabel"
    const datalabelKey = editMeta?.datalabelKey;     // "dl__project_stage"

    return {
      key: fieldKey,
      lookupSource,
      datalabelKey,
      EntityInstanceFormContainer_viz_container: {
        view: viewVizContainer,   // "DAGVisualizer"
        edit: editVizContainer    // "BadgeDropdownSelect"
      }
    };
  });
}, [metadata]);
```

### Datalabel Loading (lines 232-272)

```typescript
const { labelsMetadata, dagNodes } = useMemo(() => {
  // Filter: fields with lookupSource='datalabel' or datalabelKey
  const fieldsNeedingSettings = fields.filter(
    field => field.lookupSource === 'datalabel' || field.datalabelKey
  );

  fieldsNeedingSettings.forEach((field) => {
    // Use datalabelKey for cache lookup
    const lookupKey = field.datalabelKey || field.key;
    const cachedOptions = datalabelStore.getDatalabel(lookupKey);

    // Load DAG nodes if view uses DAGVisualizer
    if (vizContainer?.view === 'DAGVisualizer') {
      dagNodesMap.set(field.key, transformToDAGNodes(cachedOptions));
    }
  });
}, [fields]);
```

### View Mode Rendering (lines 346-374)

```typescript
// VIEW MODE: DAGVisualizer
if (vizContainer?.view === 'DAGVisualizer' && dagNodes.has(field.key)) {
  const nodes = dagNodes.get(field.key)!;
  const currentNode = nodes.find(n => n.node_name === value);

  return (
    <DAGVisualizer
      nodes={nodes}
      currentNodeId={currentNode?.id}
    />
  );
}
```

### Edit Mode Rendering (lines 627-654)

```typescript
// EDIT MODE: BadgeDropdownSelect (via select case)
if (hasLabelsMetadata && options.length > 0) {
  return (
    <BadgeDropdownSelect
      value={value}
      options={coloredOptions}
      onChange={(v) => handleFieldChange(field.key, v)}
    />
  );
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/services/pattern-mapping.yaml` | Field pattern → fieldBusinessType |
| `apps/api/src/services/view-type-mapping.yaml` | viewType metadata per component |
| `apps/api/src/services/edit-type-mapping.yaml` | editType metadata per component |
| `apps/api/src/services/backend-formatter.service.ts` | Generates API response metadata |
| `apps/web/src/db/rxdb/hooks/useRxMetadata.ts` | RxDB datalabel hooks (v8.6.0) |
| `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx` | Field rendering |
| `apps/web/src/components/workflow/DAGVisualizer.tsx` | DAG graph component |
| `apps/web/src/components/shared/ui/BadgeDropdownSelect.tsx` | Colored dropdown |

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Pattern detection in frontend | Use `viewType.renderType === 'component'` |
| Checking field name for `dl__*` | Use `editType.lookupSource === 'datalabel'` |
| Fetching datalabels per field | Use login-time cache from store |
| Hardcoded component names | Read from `viewType.component` |

---

**Version:** 8.6.0 | **Updated:** 2025-11-28 | **Status:** Production Ready
