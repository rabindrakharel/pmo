# KanbanBoard Component

**Version:** 16.0.0 | **Location:** `apps/web/src/components/shared/ui/KanbanView.tsx`, `KanbanBoard.tsx`

---

## Semantics

The Kanban system provides a standardized, settings-driven board view for any entity with kanban configuration. It integrates with the v16.0.0 architecture where **kanban configuration comes from the database** (`entity.component_views` JSONB column) via the `/api/v1/entity/codes` endpoint, column definitions come from `datalabelMetadataStore`, and card rendering uses `FormattedRow` data.

**Core Principle:** Database-driven kanban config from `component_views`. Settings-driven columns from datalabel store. DRY architecture. Backend metadata for card rendering.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      KANBAN SYSTEM ARCHITECTURE (v16.0.0)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  DATABASE: app.entity.component_views (v16.0.0)                  │    │
│  │  { "KanbanView": { "enabled": true, "groupByField": "dl__task_stage",│ │
│  │    "cardFields": ["name", "dl__task_priority", "estimated_hours"] } }│ │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  API: GET /api/v1/entity/codes                                   │    │
│  │  Returns: { data: [..., { code: 'task', component_views }] }     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  useEntityCodes Hook (TanStack Query + Dexie)                    │    │
│  │  Caches entity metadata including component_views (30-min TTL)   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  useMergedEntityConfig(entityCode, staticConfig)                 │    │
│  │  Extracts: { kanban: { groupByField, cardFields } }              │    │
│  │  Falls back to static entityConfig.ts if DB empty                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TanStack Query + Dexie Cache: getDatalabelSync(groupByField)    │    │
│  │  → { options: [{ name, label, color_code, position }] }          │    │
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
    lookupField: string;       // v12.0.0: Key for getDatalabelSync() (e.g., 'dl__task_stage')
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

kanban: {             →     getDatalabelSync(lookupField) →  columns: [
  lookupField:                                                  { id: "backlog",
  'dl__task_stage',          ↓                                    title: "Backlog",
  groupByField:              options: [                           color: "#6B7280",
  'dl__task_stage'             { name: "backlog",                 items: [...] },
}                               label: "Backlog",                { id: "todo",
                                color_code: "gray" },             title: "To Do",
                              { name: "todo",                     color: "#3B82F6",
                                label: "To Do",                   items: [...] }
                                color_code: "blue" }            ]
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
import { getDatalabelSync } from '@/db/tanstack-index';
import { extractViewType } from '@/lib/formatters';
import type { FormattedRow } from '@/lib/formatters';

export function KanbanView({
  config,
  data,
  metadata,
  onCardClick,
  onCardMove,
}: KanbanViewProps) {
  // v12.0.0: Use lookupField instead of datalabelKey
  const lookupField = config.kanban?.lookupField;
  const groupByField = config.kanban?.groupByField;

  // v12.0.0: Get column definitions from TanStack sync cache
  const datalabelData = lookupField ? getDatalabelSync(lookupField) : null;
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
    return <div>No stages configured for {lookupField}</div>;
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

### Database Configuration (v16.0.0 - Preferred)

Kanban configuration is now stored in the database `entity.component_views` JSONB column:

```sql
-- db/entity_configuration_settings/02_entity.ddl

UPDATE app.entity SET
    component_views = '{
      "EntityListOfInstancesTable": { "enabled": true, "default": true },
      "KanbanView": {
        "enabled": true,
        "groupByField": "dl__task_stage",
        "cardFields": ["name", "dl__task_priority", "estimated_hours", "assignee_employee_ids"]
      }
    }'::jsonb,
    updated_ts = now()
WHERE code = 'task';

UPDATE app.entity SET
    component_views = '{
      "EntityListOfInstancesTable": { "enabled": true, "default": true },
      "KanbanView": {
        "enabled": true,
        "groupByField": "dl__project_stage",
        "cardFields": ["name", "budget_allocated_amt"]
      }
    }'::jsonb,
    updated_ts = now()
WHERE code = 'project';
```

### Static Fallback (entityConfig.ts)

If database `component_views` is empty, falls back to static configuration:

```typescript
// entityConfig.ts (fallback only)
export const entityConfig = {
  task: {
    label: 'Task',
    labelPlural: 'Tasks',
    supportedViews: ['table', 'kanban'],
    kanban: {
      groupByField: 'dl__task_stage',      // Field in entity data
      lookupField: 'dl__task_stage',       // v12.0.0: Key for getDatalabelSync()
      cardFields: ['name', 'dl__task_priority', 'assigned__employee_id'],
    },
  },
  project: {
    label: 'Project',
    labelPlural: 'Projects',
    supportedViews: ['table', 'kanban', 'grid'],
    kanban: {
      groupByField: 'dl__project_stage',
      lookupField: 'dl__project_stage',    // v12.0.0: Key for getDatalabelSync()
      cardFields: ['name', 'budget_allocated_amt'],
    },
  },
};
```

### How Configuration is Merged (v16.0.0)

```typescript
// EntityListOfInstancesPage.tsx
import { useMergedEntityConfig } from '@/lib/hooks/useComponentViews';

const config = getEntityConfig(entityCode);  // Static fallback
const viewConfig = useMergedEntityConfig(entityCode, config);

// viewConfig.kanban comes from:
// 1. Database component_views.KanbanView (if exists)
// 2. Else: static entityConfig.kanban (fallback)

// Passed to KanbanView:
<KanbanView
  config={viewConfig}  // Contains kanban: { groupByField, cardFields }
  data={formattedData}
  // ...
/>
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

| Entity | groupByField | lookupField (v12.0.0) |
|--------|--------------|----------------------|
| Task | `dl__task_stage` | `dl__task_stage` |
| Project | `dl__project_stage` | `dl__project_stage` |
| Opportunity | `dl__opportunity_stage` | `dl__opportunity_stage` |

---

## User Interaction Flow (v8.2.0)

```
View Kanban Flow
────────────────

1. User clicks "Kanban" view toggle
   │
2. KanbanView mounts
   │
3. Get columns from TanStack sync cache (v12.0.0):
   ├── lookupField from config.kanban
   └── getDatalabelSync(lookupField) → stages array
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

1. **TanStack Sync Cache** - Columns from `getDatalabelSync()` (cached at login)
2. **FormattedRow** - Cards use pre-formatted `display` and `styles`
3. **extractViewType()** - Use helper for card field metadata
4. **No Fallbacks** - Fail explicitly if settings missing
5. **Optimistic Updates** - Immediate UI feedback on drag-drop

### Consistency Rules

| Location | Value |
|----------|-------|
| Entity config `lookupField` | `dl__task_stage` |
| Entity config `groupByField` | `dl__task_stage` |
| TanStack cache key | `dl__task_stage` |
| Entity record field | `task.dl__task_stage` |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Hardcoded stage arrays | Use `getDatalabelSync()` |
| Silent fallback columns | Explicit error display |
| Fetching stages per render | Use cached store (1h TTL) |
| Direct metadata access | Use `extractViewType(metadata)` |
| Custom card formatting | Use `FormattedRow.display[key]` |
| Using old `datalabelKey` | v12.0.0: Use `lookupField` |

---

**Last Updated:** 2025-12-06 | **Version:** 16.0.0 | **Status:** Production Ready

**Recent Updates:**
- v16.0.0 (2025-12-06):
  - **Database-driven kanban configuration** via `entity.component_views` JSONB column
  - Kanban config fetched from `/api/v1/entity/codes` endpoint
  - `useEntityCodes` hook caches entity metadata including `component_views`
  - `useMergedEntityConfig` hook extracts kanban config with static fallback
  - Configuration: `component_views.KanbanView.groupByField`, `.cardFields`
  - No code changes required to add kanban support - just DDL update
- v12.0.0 (2025-12-02):
  - Renamed `datalabelKey` → `lookupField` in entityConfig.kanban
  - Migrated from Zustand store to TanStack Query sync cache (`getDatalabelSync()`)
  - Updated all examples with v12.0.0 property names
