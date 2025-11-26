# DAG Visualizer Component

**Version:** 8.2.0 | **Location:** `apps/web/src/components/workflow/DAGVisualizer.tsx`

---

## Semantics

The DAG (Directed Acyclic Graph) Visualizer provides a visual representation of workflow stages for entities. It renders `dl__*_stage` fields as a progress path with color-coded stages using backend metadata.

**Core Principle:** Backend metadata drives rendering. Stages from datalabel store. Zero frontend pattern detection.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DAG VISUALIZER ARCHITECTURE (v8.2.0)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Backend Metadata (BFF)                        │    │
│  │  viewType.dl__project_stage = {                                  │    │
│  │    dtype: 'str',                                                 │    │
│  │    renderType: 'dag',                                            │    │
│  │    datalabelKey: 'project_stage',                                │    │
│  │    behavior: { visible: true }                                   │    │
│  │  }                                                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Datalabel Store (Zustand)                     │    │
│  │  datalabelMetadataStore.getDatalabel('project_stage')           │    │
│  │  → { options: [{ name, label, color_code, position }] }         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    DAG Visualizer                                │    │
│  │                                                                  │    │
│  │   ●───────●───────●───────●───────○                             │    │
│  │   Init   Plan    Exec    Monitor  Close                         │    │
│  │  (gray) (blue) (orange) (yellow) (green)                        │    │
│  │                    ▲                                             │    │
│  │               Current                                            │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface (v8.2.0)

```typescript
interface DAGVisualizerProps {
  /** Current stage value from entity data */
  value: string;

  /** Field key (e.g., 'dl__project_stage') */
  fieldKey: string;

  /** Backend metadata for this field */
  fieldMeta: ViewFieldMetadata;

  /** Optional: Override stage data (defaults to datalabelMetadataStore) */
  stages?: DatalabelOption[];

  /** Callback when stage is clicked (edit mode) */
  onStageClick?: (stageName: string) => void;

  /** Interactive mode (allows clicking stages) */
  interactive?: boolean;
}

// ViewFieldMetadata from backend (v8.2.0)
interface ViewFieldMetadata {
  dtype: 'str';
  label: string;
  renderType: 'dag';
  datalabelKey: string;  // Maps to datalabelMetadataStore
  behavior: {
    visible: boolean;
    filterable?: boolean;
  };
  style?: Record<string, any>;
}
```

---

## Data Flow Diagram (v8.2.0)

```
Backend → Frontend Metadata Flow
────────────────────────────────

1. Backend BFF (generateEntityResponse)
   │
   ├── API Response:
   │   {
   │     data: [{ dl__project_stage: "execution" }],
   │     metadata: {
   │       entityDataTable: {
   │         viewType: {
   │           dl__project_stage: {
   │             renderType: 'dag',
   │             datalabelKey: 'project_stage'
   │           }
   │         },
   │         editType: {
   │           dl__project_stage: {
   │             inputType: 'select',
   │             datalabelKey: 'project_stage'
   │           }
   │         }
   │       }
   │     },
   │     datalabels: { project_stage: [...] }
   │   }
   │
   v
2. React Query Cache (RAW data)
   │
   v
3. Format-at-Read (select option)
   │
   ├── formatDataset() checks viewType[field].renderType === 'dag'
   │
   └── FormattedRow = {
         raw: { dl__project_stage: 'execution' },
         display: { dl__project_stage: 'Execution' },
         styles: {}  // DAG uses custom rendering
       }
   │
   v
4. Component receives viewType via extractViewType(metadata)
   │
   ├── const viewType = extractViewType(metadata.entityDataTable);
   │
   └── if (viewType[fieldKey].renderType === 'dag') {
         render <DAGVisualizer value={row.raw[fieldKey]} fieldMeta={viewType[fieldKey]} />
       }
   │
   v
5. DAGVisualizer
   │
   ├── Reads stages from datalabelMetadataStore using fieldMeta.datalabelKey
   │
   └── Renders visual progress path
       ●───────●───────●───────○───────○
       Init   Plan    Exec   Monitor  Close
                       ▲
                  (current)
```

---

## Integration with v8.2.0 Architecture

### Component Consumption Pattern

```typescript
import { extractViewType, isValidComponentMetadata } from '@/lib/formatters';
import { useDatalabelMetadataStore } from '@/stores/datalabelMetadataStore';

function EntityFieldRenderer({ fieldKey, record, metadata }) {
  // v8.2.0: Extract viewType from nested metadata structure
  const viewType = extractViewType(metadata);

  if (!viewType) {
    console.error('[Renderer] No viewType - backend must send { viewType, editType }');
    return null;
  }

  const fieldMeta = viewType[fieldKey];

  // DAG rendering based on backend metadata
  if (fieldMeta?.renderType === 'dag') {
    return (
      <DAGVisualizer
        value={record.raw[fieldKey]}
        fieldKey={fieldKey}
        fieldMeta={fieldMeta}
      />
    );
  }

  // Other render types...
}
```

### Datalabel Store Integration

```typescript
// DAGVisualizer internal implementation
function DAGVisualizer({ value, fieldKey, fieldMeta }: DAGVisualizerProps) {
  const getDatalabel = useDatalabelMetadataStore(state => state.getDatalabel);

  // Get stages from store using datalabelKey from backend metadata
  const datalabelKey = fieldMeta.datalabelKey;
  const datalabelData = getDatalabel(datalabelKey);
  const stages = datalabelData?.options || [];

  // Find current stage position
  const currentIndex = stages.findIndex(s => s.name === value);

  return (
    <div className="flex items-center gap-2">
      {stages.map((stage, index) => (
        <React.Fragment key={stage.name}>
          {index > 0 && <div className="w-4 h-0.5 bg-gray-300" />}
          <DAGNode
            stage={stage}
            isCompleted={index < currentIndex}
            isCurrent={index === currentIndex}
            isFuture={index > currentIndex}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
```

---

## Stage Data Structure

### Datalabel Store Format

```typescript
// Stored in datalabelMetadataStore (cached at login)
interface DatalabelData {
  datalabel: string;  // 'project_stage'
  options: DatalabelOption[];
}

interface DatalabelOption {
  id: string;
  name: string;      // 'execution'
  label: string;     // 'Execution'
  color_code: string; // 'orange'
  position: number;  // 2
}
```

### Visual States

| State | Symbol | Description |
|-------|--------|-------------|
| Completed | ● (filled) | Stage has been passed |
| Current | ● (bold, highlighted) | Current position |
| Future | ○ (empty) | Not yet reached |

### Supported Colors

| color_code | Hex Value | Usage |
|------------|-----------|-------|
| `gray` | `#6B7280` | Initial/Cancelled |
| `blue` | `#3B82F6` | Planning/Pending |
| `green` | `#10B981` | Done/Success |
| `yellow` | `#F59E0B` | Warning/Monitoring |
| `orange` | `#F97316` | In Progress |
| `red` | `#EF4444` | Blocked/Error |
| `purple` | `#8B5CF6` | Review |

---

## User Interaction Flow (v8.2.0)

```
Workflow Visualization Flow
───────────────────────────

1. Page loads entity data
   │
2. useFormattedEntityList returns:
   ├── formattedData: FormattedRow[]
   └── metadata: { entityDataTable: { viewType, editType } }
   │
3. Component extracts metadata:
   const viewType = extractViewType(metadata.entityDataTable);
   │
4. For each dl__*_stage field:
   ├── viewType[field].renderType === 'dag'
   ├── viewType[field].datalabelKey → datalabelMetadataStore
   └── Render DAGVisualizer
   │
5. DAGVisualizer:
   ├── Reads stages from datalabelMetadataStore
   ├── Determines current position from value
   └── Renders visual progress path

   ●───────●───────●───────○───────○
   Init   Plan    Exec   Monitor  Close
                   ▲
              (current)


Stage Update Flow (Edit Mode)
─────────────────────────────

1. User in edit mode selects new stage
   │
2. Component uses editType from metadata:
   const editType = extractEditType(metadata.entityDataTable);
   │
3. editType[field] = {
     inputType: 'select',
     datalabelKey: 'project_stage'
   }
   │
4. DataLabelSelect renders dropdown with stages
   │
5. User selects "monitoring"
   │
6. onChange callback → updateField('dl__project_stage', 'monitoring')
   │
7. PATCH /api/v1/project/:id
   │
8. React Query invalidates cache
   │
9. DAGVisualizer re-renders with new position
```

---

## Integration Points

| Component | Integration |
|-----------|-------------|
| EntityDataTable | Checks `viewType[key].renderType === 'dag'` |
| EntityFormContainer | Renders DAG for stage fields in view mode |
| KanbanView | Uses same datalabelKey for columns |
| formatBadge() | Falls back to badge if no DAG rendering |

---

## Critical Considerations

### Design Principles (v8.2.0)

1. **Backend Metadata Driven** - `renderType: 'dag'` triggers DAG rendering
2. **Datalabel Store** - Stages from Zustand store (cached at login)
3. **Zero Pattern Detection** - No frontend field name parsing
4. **extractViewType()** - Always use helper to get viewType from metadata

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Detecting `dl__*_stage` pattern | Check `viewType[key].renderType === 'dag'` |
| Hardcoded stage colors | Use color_code from datalabel store |
| Direct metadata access | Use `extractViewType(metadata)` |
| Fetching stages in component | Use datalabelMetadataStore (cached) |

---

**Last Updated:** 2025-11-26 | **Version:** 8.2.0 | **Status:** Production Ready
