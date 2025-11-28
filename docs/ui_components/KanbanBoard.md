# KanbanBoard Component

**Version:** 8.2.0 | **Location:** `apps/web/src/components/shared/ui/KanbanView.tsx`, `KanbanBoard.tsx`

---

## Semantics

The Kanban system provides a standardized, settings-driven board view for any entity with kanban configuration. It integrates with the v8.2.0 metadata architecture where column definitions come from `datalabelMetadataStore` and card rendering uses `FormattedRow` data.

**Core Principle:** Settings-driven columns from datalabel store. DRY architecture. Backend metadata for card rendering.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      KANBAN SYSTEM ARCHITECTURE (v8.2.0)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    entityConfig.kanban                           │    │
│  │  { groupByField: 'dl__task_stage', datalabelKey: 'task_stage' } │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Datalabel Store (Zustand)                     │    │
│  │  datalabelMetadataStore.getDatalabel('task_stage')              │    │
│  │  → { options: [{ name, label, color_code, position }] }         │    │
│  │  (Cached at login, 1-hour TTL)                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    KanbanView Component                          │    │
│  │  Loading | Error | Empty | Success states                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    KanbanBoard Component                         │    │
│  │  ┌─────────┬─────────┬─────────┬─────────┬─────────┐           │    │
│  │  │ Backlog │  To Do  │In Progr │ Review  │  Done   │           │    │
│  │  │   (3)   │   (5)   │   (8)   │   (2)   │  (12)   │           │    │
│  │  ├─────────┼─────────┼─────────┼─────────┼─────────┤           │    │
│  │  │ [Card]  │ [Card]  │ [Card]  │ [Card]  │ [Card]  │           │    │
│  │  │ [Card]  │ [Card]  │ [Card]  │         │ [Card]  │           │    │
│  │  │ [Card]  │ [Card]  │         │         │ [Card]  │           │    │
│  │  └─────────┴─────────┴─────────┴─────────┴─────────┘           │    │
│  │                                                                  │    │
│  │  Cards use FormattedRow.display[key] for rendering              │    │
│  │  Drag-drop updates groupByField via PATCH API                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface (v8.2.0)

```typescript
import type { FormattedRow } from '@/lib/formatters';

interface KanbanViewProps {
  /** Entity configuration with kanban settings */
  config: EntityConfig;

  /** Array of entity items (FormattedRow[] from useFormattedEntityList) */
  data: FormattedRow<any>[];

  /** Backend metadata with { viewType, editType } structure */
  metadata?: EntityMetadata | null;

  /** Callback when card is clicked */
  onCardClick?: (item: any) => void;

  /** Callback when card is moved between columns */
  onCardMove?: (itemId: string, fromColumn: string, toColumn: string) => void;

  /** Custom card renderer (optional) */
  renderCard?: (item: FormattedRow<any>) => React.ReactNode;

  /** Custom empty message */
  emptyMessage?: string;
}

// EntityConfig with kanban settings
interface EntityConfig {
  kanban?: {
    groupByField: string;      // Field to group by (e.g., 'dl__task_stage')
    datalabelKey: string;      // Key in datalabelMetadataStore
    cardFields?: string[];     // Fields to show on card
  };
  supportedViews?: ('table' | 'kanban' | 'grid' | 'calendar')[];
}
```

---

## Data Flow Diagram (v8.2.0)

```
Column Generation Flow
──────────────────────

Entity Config                Datalabel Store                  Kanban Columns
─────────────                ───────────────                  ──────────────

kanban: {             →     datalabelMetadataStore     →     columns: [
  datalabelKey:               .getDatalabel('task_stage')     { id: "backlog",
  'task_stage',              ↓                                  title: "Backlog",
  groupByField:              options: [                         color: "#6B7280",
  'dl__task_stage'             { name: "backlog",               items: [...] },
}                               label: "Backlog",              { id: "todo",
                                color_code: "gray" },           title: "To Do",
                              { name: "todo",                   color: "#3B82F6",
                                label: "To Do",                 items: [...] }
                                color_code: "blue" }          ]
                            ]


Card Rendering Flow (v8.2.0)
────────────────────────────

FormattedRow Data           Backend viewType              Rendered Card
─────────────────           ────────────────              ─────────────

data: [                  →  viewType.name = {         →  ┌──────────────────┐
  {                           renderType: 'text'         │ Kitchen Reno      │
    raw: {                  }                            │ ─────────────────  │
      id: 'uuid',           viewType.dl__priority = {   │ Priority: High    │
      name: 'Kitchen Reno',   renderType: 'badge'       │ Budget: $50,000   │
      dl__priority: 'high'  }                            └──────────────────┘
    },
    display: {              // Card uses display values
      name: 'Kitchen Reno', // Pre-formatted from format-at-read
      dl__priority: 'High'
    },
    styles: {
      dl__priority: 'bg-red-100 text-red-700'
    }
  }
]


Card Move Flow
──────────────

User drags card        API Update           Cache Invalidation
──────────────         ──────────           ──────────────────

Card: Task-001   →    PATCH /api/v1/task/   →    Query invalidation
From: "to_do"          {id}                       │
To: "in_progress"      { dl__task_stage:          v
                         "in_progress" }          Re-render with
                                                  updated positions
```

---

## Component Implementation (v8.2.0)

### KanbanView with Datalabel Store

```typescript
import { useDatalabelMetadataStore } from '@/stores/datalabelMetadataStore';
import { extractViewType } from '@/lib/formatters';
import type { FormattedRow } from '@/lib/formatters';

export function KanbanView({
  config,
  data,
  metadata,
  onCardClick,
  onCardMove,
}: KanbanViewProps) {
  // Get datalabel from store (cached at login)
  const getDatalabel = useDatalabelMetadataStore(state => state.getDatalabel);
  const datalabelKey = config.kanban?.datalabelKey;
  const groupByField = config.kanban?.groupByField;

  // Get column definitions from datalabel store
  const datalabelData = datalabelKey ? getDatalabel(datalabelKey) : null;
  const stages = datalabelData?.options || [];

  // Get viewType for card field rendering
  const viewType = extractViewType(metadata?.entityListOfInstancesTable);

  // Build columns from stages
  const columns = useMemo(() => {
    return stages.map(stage => ({
      id: stage.name,
      title: stage.label,
      color: colorCodeToHex(stage.color_code),
      position: stage.position,
    }));
  }, [stages]);

  // Group data by groupByField
  const columnItems = useMemo(() => {
    const grouped: Record<string, FormattedRow<any>[]> = {};

    columns.forEach(col => {
      grouped[col.id] = [];
    });

    data.forEach(item => {
      const stageValue = item.raw[groupByField];
      if (grouped[stageValue]) {
        grouped[stageValue].push(item);
      }
    });

    return grouped;
  }, [data, columns, groupByField]);

  // Loading state
  if (!datalabelData) {
    return <div>Loading columns...</div>;
  }

  // Empty state
  if (stages.length === 0) {
    return <div>No stages configured for {datalabelKey}</div>;
  }

  return (
    <KanbanBoard
      columns={columns}
      columnItems={columnItems}
      viewType={viewType}
      onCardClick={onCardClick}
      onCardMove={(itemId, fromCol, toCol) => {
        onCardMove?.(itemId, fromCol, toCol);
      }}
    />
  );
}
```

### Card Rendering with FormattedRow

```typescript
function KanbanCard({
  item,
  viewType,
  onClick,
}: {
  item: FormattedRow<any>;
  viewType: Record<string, ViewFieldMetadata> | null;
  onClick?: () => void;
}) {
  const cardFields = ['name', 'dl__priority', 'budget_allocated_amt'];

  return (
    <div className="p-3 bg-white rounded shadow cursor-pointer" onClick={onClick}>
      {cardFields.map(fieldKey => {
        // Use pre-formatted display value from FormattedRow
        const displayValue = item.display[fieldKey];
        const styleClass = item.styles[fieldKey];
        const fieldMeta = viewType?.[fieldKey];

        // Badge field
        if (styleClass) {
          return (
            <span key={fieldKey} className={`rounded-full px-2 py-0.5 text-xs ${styleClass}`}>
              {displayValue}
            </span>
          );
        }

        // Regular field
        return (
          <div key={fieldKey} className="text-sm">
            {fieldMeta?.label}: {displayValue}
          </div>
        );
      })}
    </div>
  );
}
```

---

## Usage Example (v8.2.0)

```typescript
import { useFormattedEntityList } from '@/lib/hooks/useEntityQuery';
import { KanbanView } from '@/components/shared/ui/KanbanView';
import { entityConfig } from '@/lib/entityConfig';

function TaskKanbanPage() {
  const config = entityConfig.task;

  const { data: queryResult, isLoading } = useFormattedEntityList('task', {
    limit: 1000,
  });

  // queryResult contains:
  // - formattedData: FormattedRow[] (via select transform)
  // - metadata: { entityListOfInstancesTable: { viewType, editType } }
  const formattedData = queryResult?.formattedData || [];
  const metadata = queryResult?.metadata;

  const { updateEntity } = useEntityMutation('task');

  const handleCardMove = async (itemId: string, fromCol: string, toCol: string) => {
    // Optimistic update handled by React Query
    await updateEntity({
      id: itemId,
      data: { dl__task_stage: toCol },
    });
  };

  return (
    <KanbanView
      config={config}
      data={formattedData}
      metadata={metadata}
      onCardClick={(item) => navigate(`/task/${item.raw.id}`)}
      onCardMove={handleCardMove}
    />
  );
}
```

---

## Entity Config Setup

```typescript
// entityConfig.ts
export const entityConfig = {
  task: {
    label: 'Task',
    labelPlural: 'Tasks',
    supportedViews: ['table', 'kanban'],
    kanban: {
      groupByField: 'dl__task_stage',      // Field in entity data
      datalabelKey: 'task_stage',          // Key in datalabelMetadataStore
      cardFields: ['name', 'dl__task_priority', 'assigned__employee_id'],
    },
  },
  project: {
    label: 'Project',
    labelPlural: 'Projects',
    supportedViews: ['table', 'kanban', 'grid'],
    kanban: {
      groupByField: 'dl__project_stage',
      datalabelKey: 'project_stage',
      cardFields: ['name', 'budget_allocated_amt'],
    },
  },
};
```

---

## Database/API/UI Mapping

### Settings to Column Mapping

| Datalabel Field | Column Property |
|-----------------|-----------------|
| `name` | `id` (column identifier) |
| `label` | `title` (column header) |
| `color_code` | `color` (mapped to hex) |
| `position` | Column order |

### Color Mapping

| color_code | Hex Value | Usage |
|------------|-----------|-------|
| `gray` | `#6B7280` | Initial/Cancelled |
| `blue` | `#3B82F6` | Planning/Pending |
| `orange` | `#F59E0B` | In Progress |
| `purple` | `#8B5CF6` | Review |
| `red` | `#EF4444` | Blocked |
| `green` | `#10B981` | Done/Success |

### Entity to Kanban Support

| Entity | groupByField | datalabelKey |
|--------|--------------|--------------|
| Task | `dl__task_stage` | `task_stage` |
| Project | `dl__project_stage` | `project_stage` |
| Opportunity | `dl__opportunity_stage` | `opportunity_stage` |

---

## User Interaction Flow (v8.2.0)

```
View Kanban Flow
────────────────

1. User clicks "Kanban" view toggle
   │
2. KanbanView mounts
   │
3. Get columns from datalabelMetadataStore:
   ├── datalabelKey from config.kanban
   └── getDatalabel(datalabelKey) → stages array
   │
4. Get viewType for card rendering:
   const viewType = extractViewType(metadata.entityListOfInstancesTable);
   │
5. KanbanBoard renders:
   ├── Creates column for each stage
   ├── Groups FormattedRow[] by groupByField
   └── Renders cards using row.display[key], row.styles[key]
   │
6. User sees:
   ┌─────────┬─────────┬─────────┐
   │ To Do   │In Progr │  Done   │
   │  (5)    │   (3)   │  (10)   │
   ├─────────┼─────────┼─────────┤
   │ [Card]  │ [Card]  │ [Card]  │
   └─────────┴─────────┴─────────┘


Drag-Drop Flow
──────────────

1. User drags card from "To Do" to "In Progress"
   │
2. onCardMove callback:
   onCardMove(taskId, "to_do", "in_progress")
   │
3. API call (optimistic update):
   PATCH /api/v1/task/:id
   { dl__task_stage: "in_progress" }
   │
4. React Query invalidation
   │
5. Board re-renders:
   Card now appears in "In Progress" column


Settings Change Flow
────────────────────

1. Admin updates stage in settings page
   │
2. datalabelMetadataStore invalidated
   │
3. User refreshes Kanban view
   │
4. getDatalabel() returns updated stages
   │
5. Board renders with new column
```

---

## Critical Considerations

### Design Principles (v8.2.0)

1. **Datalabel Store** - Columns from `datalabelMetadataStore` (cached at login)
2. **FormattedRow** - Cards use pre-formatted `display` and `styles`
3. **extractViewType()** - Use helper for card field metadata
4. **No Fallbacks** - Fail explicitly if settings missing
5. **Optimistic Updates** - Immediate UI feedback on drag-drop

### Consistency Rules

| Location | Value |
|----------|-------|
| Entity config `datalabelKey` | `task_stage` |
| Entity config `groupByField` | `dl__task_stage` |
| Datalabel store key | `task_stage` |
| Entity record field | `task.dl__task_stage` |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Hardcoded stage arrays | Use datalabelMetadataStore |
| Silent fallback columns | Explicit error display |
| Fetching stages per render | Use cached store (1h TTL) |
| Direct metadata access | Use `extractViewType(metadata)` |
| Custom card formatting | Use `FormattedRow.display[key]` |

---

**Last Updated:** 2025-11-26 | **Version:** 8.2.0 | **Status:** Production Ready
