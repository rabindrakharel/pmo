# DAG Visualizer Component

**Version:** 1.0.0 | **Location:** `apps/web/src/components/shared/ui/DAGVisualizer.tsx`

---

## Semantics

The DAG (Directed Acyclic Graph) Visualizer provides a visual representation of workflow stages for entities. It automatically activates for `dl__*_stage` fields and renders them as a progress path with color-coded stages.

**Core Principle:** Auto-detection via naming convention. Stages from settings table. Zero configuration.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DAG VISUALIZER ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Field Detection                               │    │
│  │  Column name matches: dl__*_stage                               │    │
│  │  Backend metadata: renderType: 'dag', component: 'DAGVisualizer'│    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Settings API                                  │    │
│  │  GET /api/v1/setting?datalabel=dl__project_stage                │    │
│  │  Returns: [ { name, color_code, position }, ... ]               │    │
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

## Data Flow Diagram

```
Stage Data Flow
───────────────

Database Column                Settings Table                DAG Visualizer
───────────────                ──────────────                ──────────────

dl__project_stage     →        setting_datalabel     →       Visual Progress
  = "execution"                 datalabel_name:               Path
                                'dl__project_stage'
                                                              ●──●──●──○──○
                                metadata: [                   │  │  ▲  │  │
                                  {name: "Initiation",        │  │  │  │  │
                                   color_code: "gray"},       │  │  Current
                                  {name: "Planning",          │  │
                                   color_code: "blue"},       │  │
                                  {name: "Execution",         Completed
                                   color_code: "orange"},
                                  ...
                                ]
```

---

## Architecture Overview

### Naming Convention

| Pattern | Description | Example |
|---------|-------------|---------|
| `dl__*_stage` | Workflow stage field | `dl__project_stage`, `dl__task_stage` |

### Stage Data Structure

| Field | Purpose | Example |
|-------|---------|---------|
| `name` | Display label | "Planning" |
| `color_code` | Stage color | "blue" |
| `position` | Order in workflow | 1 |

### Visual States

| State | Symbol | Description |
|-------|--------|-------------|
| Completed | ● (filled) | Stage has been passed |
| Current | ● (bold, highlighted) | Current position |
| Future | ○ (empty) | Not yet reached |

### Supported Colors

| Color Code | Hex Value | Usage |
|------------|-----------|-------|
| `gray` | `#6B7280` | Initial/Cancelled |
| `blue` | `#3B82F6` | Planning/Pending |
| `green` | `#10B981` | Done/Success |
| `yellow` | `#F59E0B` | Warning/Monitoring |
| `orange` | `#F97316` | In Progress |
| `red` | `#EF4444` | Blocked/Error |
| `purple` | `#8B5CF6` | Review |
| `indigo` | `#6366F1` | Special |

---

## Tooling Overview

### Database Setup

```sql
-- Settings table entry
INSERT INTO app.setting_datalabel (
  datalabel_name, ui_label, metadata
) VALUES (
  'dl__project_stage',
  'Project Stage',
  '[
    {"id": 0, "name": "Initiation", "color_code": "gray"},
    {"id": 1, "name": "Planning", "color_code": "blue"},
    {"id": 2, "name": "Execution", "color_code": "orange"},
    {"id": 3, "name": "Monitoring", "color_code": "yellow"},
    {"id": 4, "name": "Closure", "color_code": "green"}
  ]'::jsonb
);
```

### Component Integration

```typescript
// Auto-detected by formatter service when field matches dl__*_stage
// No manual component usage required

// Backend metadata generation
{
  key: "dl__project_stage",
  renderType: "dag",
  component: "DAGVisualizer",
  loadFromDataLabels: true
}

// Frontend renders DAGVisualizer automatically
```

---

## Database/API/UI Mapping

### Field to Visualization

| Entity | Field | Stages |
|--------|-------|--------|
| Project | `dl__project_stage` | Initiation → Planning → Execution → Monitoring → Closure |
| Task | `dl__task_stage` | Backlog → To Do → In Progress → Review → Done |
| Order | `dl__order_stage` | Received → Processing → Shipped → Delivered |

### API Response

```json
{
  "datalabels": [
    {
      "datalabel": "dl__project_stage",
      "options": [
        { "id": "0", "name": "Initiation", "color_code": "gray", "position": 0 },
        { "id": "1", "name": "Planning", "color_code": "blue", "position": 1 },
        { "id": "2", "name": "Execution", "color_code": "orange", "position": 2 }
      ]
    }
  ]
}
```

---

## User Interaction Flow

```
Workflow Visualization Flow
───────────────────────────

1. User views project detail page
   │
2. API response includes:
   ├── data.dl__project_stage = "execution"
   └── datalabels[dl__project_stage] = [{stages...}]
   │
3. Frontend formatter service:
   ├── Detects dl__*_stage pattern
   ├── Reads metadata.renderType = 'dag'
   └── Renders DAGVisualizer component
   │
4. DAGVisualizer:
   ├── Maps stages from datalabels
   ├── Determines current position
   └── Renders visual progress path
   │
5. User sees:
   ●───────●───────●───────○───────○
   Init   Plan    Exec   Monitor  Close
                   ▲
              (current)


Stage Update Flow
─────────────────

1. User selects new stage from dropdown
   │
2. PATCH /api/v1/project/:id
   { dl__project_stage: "monitoring" }
   │
3. API updates database
   │
4. React Query invalidates cache
   │
5. DAGVisualizer re-renders:
   ●───────●───────●───────●───────○
   Init   Plan    Exec   Monitor  Close
                           ▲
                      (current)
```

---

## Critical Considerations

### Design Principles

1. **Convention-Based** - `dl__*_stage` pattern triggers DAG
2. **Settings-Driven** - Stages from `setting_datalabel` table
3. **Zero Config** - No frontend configuration needed
4. **Color Consistency** - Colors from database, not hardcoded

### Common Use Cases

| Use Case | Field | Stages |
|----------|-------|--------|
| Project Lifecycle | `dl__project_stage` | 5 stages |
| Task Workflow | `dl__task_stage` | 7 stages |
| Order Processing | `dl__order_stage` | 4 stages |
| Approval Workflow | `dl__approval_stage` | 3 stages |
| Service Requests | `dl__service_stage` | 4 stages |

### Integration Points

| Component | Integration |
|-----------|-------------|
| EntityFormContainer | Renders DAG for stage fields |
| EntityDetailPage | Shows workflow progress |
| KanbanView | Uses same stage data for columns |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Hardcoded stage colors | Use color_code from settings |
| Manual DAG rendering | Let formatter service auto-detect |
| Stage order in frontend | Use position from settings |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
