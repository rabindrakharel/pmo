# KanbanBoard Component

**Version:** 2.0.0 | **Location:** `apps/web/src/components/shared/ui/KanbanView.tsx`, `KanbanBoard.tsx`

---

## Semantics

The Kanban system provides a standardized, settings-driven board view for any entity with kanban configuration. All columns are loaded from the unified settings table (`setting_datalabel`) with **no hardcoded fallbacks**.

**Core Principle:** Settings-driven columns. DRY architecture. No fallbacks - fail explicitly if misconfigured.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      KANBAN SYSTEM ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    entityConfig.kanban                           │    │
│  │  { groupByField: 'dl__task_stage', metaTable: 'dl__task_stage' }│    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    useKanbanColumns Hook                         │    │
│  │  GET /api/v1/setting?datalabel=dl__task_stage                   │    │
│  │  → Returns stage definitions with colors and positions          │    │
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
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Column Generation Flow
──────────────────────

Entity Config                Settings API                   Kanban Columns
─────────────                ────────────                   ──────────────

kanban: {              →     GET /api/v1/setting      →     columns: [
  metaTable:                  ?datalabel=dl__task_stage      { id: "Backlog",
  'dl__task_stage',                                            title: "Backlog",
  groupByField:              Response:                          color: "#6B7280",
  'dl__task_stage'           { data: [                          items: [...] },
}                              { name: "Backlog",              { id: "To Do",
                                 color_code: "gray" },           title: "To Do",
                               { name: "To Do",                  color: "#3B82F6",
                                 color_code: "blue" }            items: [...] }
                             ]}                               ]


Card Move Flow
──────────────

User drags card        API Update           Refetch
──────────────         ──────────           ───────

Card: Task-001   →    PATCH /api/v1/task/    →    Query invalidation
From: "To Do"         {id}                        │
To: "In Progress"     { dl__task_stage:           v
                        "In Progress" }           Re-render with
                                                  updated positions
```

---

## Architecture Overview

### Components

| Component | File | Purpose |
|-----------|------|---------|
| KanbanView | `KanbanView.tsx` | High-level wrapper with states |
| KanbanBoard | `KanbanBoard.tsx` | Low-level drag-drop implementation |
| useKanbanColumns | `hooks/useKanbanColumns.ts` | Settings loader + column builder |

### States

| State | Display | Trigger |
|-------|---------|---------|
| Loading | Spinner | Fetching settings |
| Error | Error message | Settings API failure |
| Empty | Warning | No stages configured |
| Success | Kanban board | Stages loaded |

### Configuration

| Config Field | Purpose | Example |
|--------------|---------|---------|
| `groupByField` | Field to group items | `dl__task_stage` |
| `metaTable` | Settings datalabel | `dl__task_stage` |
| `cardFields` | Fields shown on card | `['name', 'priority']` |

---

## Tooling Overview

### Entity Config Setup

```typescript
// entityConfig.ts
entityConfigs.task = {
  // ... other config
  supportedViews: ['table', 'kanban'],
  kanban: {
    groupByField: 'dl__task_stage',
    metaTable: 'dl__task_stage',
    cardFields: ['name', 'dl__task_priority', 'assigned_employee']
  }
};
```

### Database Setup

```sql
-- setting_datalabel table
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, metadata)
VALUES (
  'dl__task_stage',
  'Task Stage',
  '[
    {"id": 0, "name": "Backlog", "color_code": "gray"},
    {"id": 1, "name": "To Do", "color_code": "blue"},
    {"id": 2, "name": "In Progress", "color_code": "orange"},
    {"id": 3, "name": "In Review", "color_code": "purple"},
    {"id": 4, "name": "Blocked", "color_code": "red"},
    {"id": 5, "name": "Done", "color_code": "green"},
    {"id": 6, "name": "Cancelled", "color_code": "gray"}
  ]'::jsonb
);
```

### Component Usage

```typescript
// In EntityListOfInstancesPage
<KanbanView
  config={config}
  data={tasks}
  onCardClick={(task) => navigate(`/task/${task.id}`)}
  onCardMove={(taskId, fromStage, toStage) =>
    updateTask(taskId, { dl__task_stage: toStage })
  }
/>
```

---

## Database/API/UI Mapping

### Settings to Column Mapping

| Settings Field | Column Property |
|----------------|-----------------|
| `name` | `title`, `id` |
| `color_code` | `color` (mapped to hex) |
| `position` (from array index) | Column order |

### Color Mapping

| color_code | Hex Value |
|------------|-----------|
| `gray` | `#6B7280` |
| `blue` | `#3B82F6` |
| `orange` | `#F59E0B` |
| `purple` | `#8B5CF6` |
| `red` | `#EF4444` |
| `green` | `#10B981` |

### Entity to Kanban Support

| Entity | groupByField | metaTable |
|--------|--------------|-----------|
| Task | `dl__task_stage` | `dl__task_stage` |
| Project | `dl__project_stage` | `dl__project_stage` |
| Opportunity | `dl__opportunity_stage` | `dl__opportunity_stage` |

---

## User Interaction Flow

```
View Kanban Flow
────────────────

1. User clicks "Kanban" view toggle
   │
2. KanbanView mounts
   │
3. useKanbanColumns hook:
   ├── Extracts metaTable from config.kanban
   ├── Fetches GET /api/v1/setting?datalabel={metaTable}
   └── Maps response to column format
   │
4. KanbanBoard renders:
   ├── Creates column for each stage
   ├── Groups items by groupByField value
   └── Renders cards in columns
   │
5. User sees:
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
   onCardMove(taskId, "To Do", "In Progress")
   │
3. API call:
   PATCH /api/v1/task/:id
   { dl__task_stage: "In Progress" }
   │
4. React Query invalidation
   │
5. Board refetches and re-renders:
   Card now appears in "In Progress" column


Settings Change Flow
────────────────────

1. Admin updates stage in settings:
   - Rename "To Do" → "Ready to Start"
   │
2. User refreshes Kanban view
   │
3. useKanbanColumns refetches settings
   │
4. Board renders with new column name:
   "Ready to Start" instead of "To Do"
```

---

## Critical Considerations

### Design Principles

1. **Settings-Driven** - All columns from `setting_datalabel`
2. **No Fallbacks** - Fail explicitly if settings missing
3. **DRY** - Single implementation for all entity kanbans
4. **Consistent Naming** - `dl__` prefix everywhere
5. **Error Transparency** - Show clear error, not silent fallback

### Consistency Rules

| Location | Value |
|----------|-------|
| Entity config `metaTable` | `dl__task_stage` |
| Entity config `groupByField` | `dl__task_stage` |
| API parameter | `?datalabel=dl__task_stage` |
| Database column | `datalabel_name = 'dl__task_stage'` |
| Entity record field | `task.dl__task_stage` |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Settings API error | Show error message, no fallback |
| Empty settings | Show "No stages configured" |
| Missing kanban config | Show "Kanban not supported" |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Hardcoded stage arrays | Use settings API |
| Silent fallback columns | Explicit error display |
| Custom column per entity | Single useKanbanColumns hook |
| Mismatched dl__ naming | Consistent dl__ everywhere |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
