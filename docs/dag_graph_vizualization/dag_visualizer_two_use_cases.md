# DAGVisualizer: Reusable Graph Component - Two Use Cases

## 1. Semantics & Business Context

The **DAGVisualizer** is a pure, reusable React component that renders directed acyclic graphs (DAGs) with horizontal left-to-right flow. It serves two distinct business purposes in the PMO platform:

### Use Case 1: Entity Lifecycle Stage Progression
**Business Purpose**: Visualize and control the lifecycle stages of a single entity instance.

**Example Scenarios**:
- Project lifecycle: Initiation → Planning → Execution → Closure → Archived
- Task workflow: Backlog → Planning → To Do → In Progress → In Review → Completed
- Customer opportunity funnel: Lead → Qualified → Proposal → Negotiation → Closed Won/Lost
- Form approval: Draft → Submitted → Under Review → Approved/Rejected
- Quote stages: Draft → Sent → Negotiating → Accepted/Rejected

**User Interaction**:
- **Read Mode**: View current stage with visual indicators (green twinkling dot for current, checkmarks for completed)
- **Edit Mode**: Click nodes to update entity's current stage, moving it through lifecycle

### Use Case 2: Workflow Entity Sequence
**Business Purpose**: Visualize multi-entity business processes where different entity types are created sequentially.

**Example Scenarios**:
- Home Services: Customer → Quote → Work Order → Task → Invoice
- Sales Process: Lead → Opportunity → Quote → Order → Fulfillment → Invoice
- Support Flow: Customer → Ticket → Task → Resolution → Feedback

**User Interaction**: Click nodes to view details of each entity in the workflow sequence.

---

## 2. Architecture & DRY Design Patterns

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              DAGVisualizer (Pure Component)                      │
│              Location: apps/web/src/components/workflow/         │
│                                                                   │
│  Props:                                                           │
│  • nodes: DAGNode[]     → Minimal data structure                │
│  • currentNodeId        → Highlight current node                │
│  • onNodeClick()        → Optional click handler                │
│                                                                   │
│  Visual Specifications:                                           │
│  • Node dimensions: 140×38px pill shapes (rx=18.5)              │
│  • Border: 1px gray stroke (#6b7280) with rounded corners        │
│  • Spacing: 80px horizontal, 18px vertical                       │
│  • Arrows: 1px gray bezier curves with arrowheads               │
│  • Layout: Horizontal left-to-right with topological layers     │
│                                                                   │
│  Responsibilities:                                                │
│  • Topological layout   (layers, positioning)                    │
│  • SVG rendering        (nodes, edges, arrows)                   │
│  • Visual states        (current, completed, future)             │
│  • Click event routing                                           │
└───────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                              │
┌─────────▼────────────┐    ┌───────────▼────────────┐
│  EntityFormContainer │    │  WorkflowDetailPage    │
│  (Use Case 1)        │    │  (Use Case 2)          │
│                      │    │                        │
│  Prepares:           │    │  Prepares:             │
│  • Stage DAG         │    │  • Entity type DAG     │
│  • Current stage     │    │  • Entity labels       │
│  • Stage updater     │    │  • Entity loader       │
└──────────────────────┘    └────────────────────────┘
```

### Core DAGNode Interface (Minimal, Reusable)

```typescript
export interface DAGNode {
  id: number;           // Node identifier (state_id or position)
  node_name: string;    // Display label shown in the node
  parent_ids: number[]; // Array of parent node IDs for arrows (MUST be array)
}
```

**DRY Principle**: Single interface serves both use cases. All semantic differences handled by parent components.

### Visual Design System

**Node Visual States**:
- **Future Node**: White fill (#ffffff), 1px gray stroke (#6b7280)
- **Completed Node**: White fill, 1px gray stroke, gray checkmark badge (top-right)
- **Current Node**: White fill, 1px gray stroke, animated green twinkling dot (top-right)

**Node Specifications**:
```css
Width: 140px
Height: 38px
Border Radius: 18.5px (pill shape)
Border: 1px solid #6b7280
Stroke Join: round (smooth corners)
Shape Rendering: geometricPrecision (consistent borders)
```

**Edge/Arrow Specifications**:
```css
Stroke Width: 1px
Stroke Color: #9ca3af (gray)
Path: Cubic bezier curves
Marker: Arrowhead at end (url(#arrowhead))
```

**Layout Algorithm**:
1. **Topological Sort**: Nodes arranged in layers based on `parent_ids` dependencies
2. **Horizontal Positioning**: Each layer positioned (nodeWidth + horizontalSpacing) apart
3. **Vertical Positioning**: Nodes in same layer stacked with verticalSpacing
4. **Edge Calculation**: Bezier curves from node center to child node center
5. **Spacing Constants**:
   - Node dimensions: 140×38px
   - Horizontal spacing: 80px
   - Vertical spacing: 18px

**Critical**: `parent_ids` MUST be an array. The layout algorithm uses array operations to determine dependencies and layering. Empty array `[]` for root nodes, `[0]` for single parent, `[2, 3]` for multiple parents.

---

## 3. Database, API & UI/UX Mapping

### Use Case 1: Entity Stage Visualization

**Database Schema**:
```sql
-- Unified settings table stores all stage definitions
CREATE TABLE app.datalabel (
    datalabel_name VARCHAR(100) PRIMARY KEY,  -- e.g., 'dl__task_stage'
    ui_label VARCHAR(100) NOT NULL,
    ui_icon VARCHAR(50),
    metadata JSONB NOT NULL,                  -- Array of stage objects
    updated_ts TIMESTAMPTZ DEFAULT now()
);

-- Each stage object in metadata JSONB array:
{
  "id": 0,                          -- Stage ID (integer, sequential)
  "name": "In Progress",            -- Stage name (human-readable)
  "descr": "Tasks actively worked", -- Description
  "parent_ids": [2],                -- MUST BE ARRAY: Parent stage IDs
  "entity_name": "task",            -- Entity type this applies to
  "terminal_flag": false,           -- Is this an end state?
  "color_code": "yellow"            -- Badge color
}

-- Entity tables store current stage name
CREATE TABLE app.d_task (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    dl__task_stage VARCHAR(100),    -- Current stage name (matches stage.name)
    -- ... other fields
);
```

**Critical Database Rule**: All settings metadata MUST use `"parent_ids": []` (array format):
- Root nodes: `"parent_ids": []` (empty array)
- Single parent: `"parent_ids": [0]` (array with one element)
- Multiple parents: `"parent_ids": [2, 3]` (array with multiple elements)
- **NEVER** use `"parent_id": null` or `"parent_id": 0` (singular format causes vertical stacking)

**API Flow**:
```
1. Load Stage Structure (DAG topology)
   GET /api/v1/datalabel?name=dl__task_stage&raw=true

   Response: {
     "data": [
       {"id": 0, "name": "Backlog", "parent_ids": [], "color_code": "gray"},
       {"id": 1, "name": "Planning", "parent_ids": [0], "color_code": "purple"},
       {"id": 2, "name": "To Do", "parent_ids": [1], "color_code": "blue"},
       {"id": 3, "name": "In Progress", "parent_ids": [2], "color_code": "yellow"}
     ],
     "datalabel": "dl__task_stage"
   }

2. Current Value (from entity table)
   From entity data: task.dl__task_stage = "In Progress"

3. Stage Update (on node click in edit mode)
   PUT /api/v1/task/{id}
   Body: {"dl__task_stage": "Completed"}
```

**UI/UX Data Flow**:
```
EntityFormContainer.tsx (lines 126-178)
  ↓
  loadDagNodes("dl__task_stage")
  ↓
  Fetches: GET /api/v1/datalabel?name=dl__task_stage&raw=true
  ↓
  Transforms to DAGNode[] with robust parent_ids handling:
  {
    id: item.id,
    node_name: item.name,
    parent_ids: Array.isArray(item.parent_ids) ? item.parent_ids :
                (item.parent_id != null ? [item.parent_id] : [])
  }
  ↓
  Finds currentNode by matching task.dl__task_stage === node.node_name
  ↓
  Renders: <DAGVisualizer nodes={nodes} currentNodeId={current?.id} />
  ↓
  User clicks node → onNodeClick(nodeId) → onChange(field, node.node_name)
```

### Use Case 2: Workflow Entity Sequence

**Database Schema**:
```sql
-- Workflow templates define entity sequence structure
CREATE TABLE app.d_industry_workflow_graph_head (
    id UUID PRIMARY KEY,
    workflow_graph JSONB NOT NULL,       -- Template structure
    industry_sector VARCHAR(100),
    -- ... other fields
);

-- workflow_graph JSONB structure:
[
  {"id": 0, "entity_name": "cust", "parent_ids": []},
  {"id": 1, "entity_name": "quote", "parent_ids": [0]},
  {"id": 2, "entity_name": "work_order", "parent_ids": [1]},
  {"id": 3, "entity_name": "task", "parent_ids": [2]},
  {"id": 4, "entity_name": "invoice", "parent_ids": [3]}
]

-- Workflow instances track actual entity creation
CREATE TABLE app.d_industry_workflow_graph_data (
    workflow_instance_id VARCHAR(50) PRIMARY KEY,
    workflow_template_id UUID REFERENCES d_industry_workflow_graph_head(id),
    workflow_graph_data JSONB NOT NULL,  -- Instance data
    active_flag BOOLEAN DEFAULT true
);

-- workflow_graph_data JSONB structure:
[
  {
    "id": 0,                             -- Node position
    "entity_name": "cust",               -- Entity type
    "entity_id": "uuid-123",             -- Actual entity UUID
    "parent_ids": [],                    -- Parents in sequence
    "current_flag": true,                -- Currently here
    "terminal_flag": false               -- Is end state
  }
]
```

**API Flow**:
```
1. Load Workflow Template (structure)
   GET /api/v1/workflow/{instance_id}/graph
   Response: {workflow_graph: [{id, entity_name, parent_ids}, ...]}

2. Load Workflow Instance (entity IDs + flags)
   GET /api/v1/workflow/{instance_id}
   Response: {
     workflow_graph_data: [{id, entity_name, entity_id, current_flag}, ...]
   }

3. Frontend Transformation (WorkflowDetailPage.tsx:111-133)
   Merges template + instance + entity config:
   {
     id: templateNode.id,
     node_name: entityConfig.displayName,  // "Customer", "Quote", etc.
     parent_ids: templateNode.parent_ids
   }

4. Entity Details (on node click)
   GET /api/v1/{entity_code}/{entity_id}
   Response: Full entity record
```

**UI/UX Data Flow**:
```
WorkflowDetailPage.tsx
  ↓
  loadWorkflowGraph() → GET /workflow/{id}/graph
  loadWorkflowData() → GET /workflow/{id}
  ↓
  Merges template structure + instance entity IDs
  ↓
  Transforms to DAGNode[] using entityConfig:
  nodes.map(templateNode => ({
    id: templateNode.id,
    node_name: getEntityConfig(templateNode.entity_name).displayName,
    parent_ids: templateNode.parent_ids
  }))
  ↓
  Renders: <DAGVisualizer nodes={mergedGraph} currentNodeId={current?.id} />
  ↓
  User clicks node → Loads entity → Shows in EntityFormContainer
```

---

## 4. Entity Relationships

**Database Changes (datalabel.ddl)**:

All 18 settings categories now use consistent `parent_ids` array format:

```sql
-- BEFORE (inconsistent, caused vertical stacking):
{"id": 0, "name": "Lead", "parent_id": null, ...}      -- Wrong
{"id": 1, "name": "Qualified", "parent_id": 0, ...}    -- Wrong

-- AFTER (consistent, enables horizontal flow):
{"id": 0, "name": "Lead", "parent_ids": [], ...}       -- Correct
{"id": 1, "name": "Qualified", "parent_ids": [0], ...} -- Correct
```

**Affected Settings Categories**:
1. `dl__task_stage` - Task lifecycle stages
2. `dl__task_priority` - Task priority levels
3. `dl__task_update_type` - Task update types
4. `dl__project_stage` - Project lifecycle stages
5. `dl__form_submission_status` - Form submission workflow
6. `dl__form_approval_status` - Form approval workflow
7. `dl__wiki_publication_status` - Wiki publication states
8. `dl__customer_opportunity_funnel` - Sales funnel stages
9. `dl__client_status` - Client lifecycle states
10. `dl__client_level` - Client tier levels
11. `dl__office_level` - Office hierarchy levels
12. `dl__business_level` - Business unit hierarchy
13. `dl__position_level` - Position hierarchy
14. `dl__industry_sector` - Industry categorization
15. `dl__acquisition_channel` - Customer acquisition channels
16. `dl__customer_tier` - Customer segmentation
17. All other stage/funnel fields

**Impact**: Horizontal DAG layout with proper arrow connections now works universally across all stage/funnel visualizations.

---

## 5. Central Configuration & Middleware

### Stage Field Detection

**EntityFormContainer.tsx (lines 118-124)**:
```typescript
const isStageField = (fieldKey: string): boolean => {
  const lowerKey = fieldKey.toLowerCase();
  // All dl__ fields containing 'stage' or 'funnel' use DAG visualization
  return lowerKey.startsWith('dl__') &&
         (lowerKey.includes('stage') || lowerKey.includes('funnel'));
};
```

**Auto-detection triggers**:
- `dl__task_stage` → Shows DAG
- `dl__project_stage` → Shows DAG
- `dl__customer_opportunity_funnel` → Shows DAG
- `dl__form_approval_status` → Shows DAG (contains approval workflow stages)

### Data Transformation Layer

**EntityFormContainer.tsx:129-178** - Robust `loadDagNodes()`:
```typescript
const loadDagNodes = async (fieldKey: string): Promise<DAGNode[]> => {
  const datalabel = fieldKey.startsWith('dl__') ? fieldKey : `dl__${fieldKey}`;
  const response = await fetch(
    `${API_BASE_URL}/api/v1/datalabel?name=${datalabel}&raw=true`
  );
  const result = await response.json();

  return result.data.map((item: any) => {
    // Robust handling for both parent_ids (array) and parent_id (singular)
    let parentIds: number[] = [];
    if (Array.isArray(item.parent_ids)) {
      parentIds = item.parent_ids;              // Preferred format
    } else if (item.parent_id !== null && item.parent_id !== undefined) {
      parentIds = [item.parent_id];             // Backward compatibility
    }

    return {
      id: item.id,
      node_name: item.name,
      parent_ids: parentIds                     // Always array
    };
  });
};
```

**Key Features**:
- Prefers `parent_ids` array format (current standard)
- Falls back to `parent_id` singular for backward compatibility
- Always returns `parent_ids` as array to DAGVisualizer
- Logs transformation for debugging

### Entity Configuration Integration

**WorkflowDetailPage.tsx (lines 115-133)**:
```typescript
const dagNodes = workflowGraph.map((templateNode) => {
  const instanceEntity = graphData.find(e => e.id === templateNode.id);
  const entityConfig = getEntityConfig(templateNode.entity_name);
  const displayName = entityConfig?.displayName || templateNode.entity_name;

  return {
    id: templateNode.id,                    // DAG position (0, 1, 2, ...)
    node_name: displayName,                 // "Customer", "Task", etc.
    parent_ids: templateNode.parent_ids     // Workflow structure
  };
});
```

**Entity Display Name Mappings** (from entityConfig.ts):
- `cust` → "Customer"
- `quote` → "Quote"
- `work_order` → "Work Order"
- `task` → "Task"
- `invoice` → "Invoice"

---

## 6. User Interaction Flow Examples

### Flow 1: Entity Stage Update (Edit Mode)

**Scenario**: Sales rep moves customer opportunity from "Qualified" to "Proposal"

**URL**: `http://localhost:5173/quote/40208144-ef14-4001-955b-0a170ce82982`

```
User Action                          System Response
──────────────────────────────────────────────────────────────────────
1. Opens quote detail                → EntityFormContainer loads
   /quote/{id}                         - Fetches quote data
                                        - Detects dl__customer_opportunity_funnel
                                        - Loads DAG: GET /setting?datalabel=...&raw=true

2. Views stage visualization         → DAG renders horizontally:
   (Read-only mode)                    Lead → Qualified → Proposal → Negotiation → Won/Lost
                                        - Current: "Qualified" (green twinkling dot)
                                        - Completed: "Lead" (gray checkmark)
                                        - Future: Proposal, Negotiation, Won/Lost (gray)

3. Clicks "Edit" button              → Switches to edit mode
                                        - Yellow hint: "Click a node below to change stage"
                                        - DAGVisualizer onNodeClick handler enabled

4. Clicks "Proposal" node            → onNodeClick(2) triggered
   in DAG                               - Finds node: {id: 2, node_name: "Proposal"}
                                        - Calls onChange("dl__customer_opportunity_funnel",
                                                       "Proposal")
                                        - UI updates immediately (optimistic)

5. Clicks "Save"                     → PUT /api/v1/quote/{id}
                                        Body: {"dl__customer_opportunity_funnel": "Proposal"}

6. DAG updates                       → Visual state changes:
                                        - "Lead" & "Qualified": checkmarks (completed)
                                        - "Proposal": green dot (current)
                                        - Arrows show: Lead → Qualified → Proposal ✓
```

### Flow 2: Workflow Entity Inspection (Read-Only)

**Scenario**: Operations manager reviews home services workflow progress

**URL**: `http://localhost:5173/workflow/WFI-2024-002`

```
User Action                          System Response
──────────────────────────────────────────────────────────────────────
1. Navigates to workflow             → WorkflowDetailPage loads
   /workflow/WFI-2024-002              - GET /workflow/{id} → instance data
                                        - GET /workflow/{id}/graph → template

2. Views DAG visualization           → Merges template + instance
                                        Horizontal layout:
                                        Customer → Quote → Work Order → Task → Invoice

                                        Visual indicators:
                                        - Customer: checkmark (entity created)
                                        - Quote: checkmark (entity created)
                                        - Work Order: checkmark (entity created)
                                        - Task: green twinkling dot (current)
                                        - Invoice: gray (not created yet)

                                        Arrows visible between all nodes

3. Clicks "Customer" node            → handleStateClick(0) triggered
                                        - Finds entity in workflow_graph_data:
                                          {id: 0, entity_name: "cust",
                                           entity_id: "uuid-123"}
                                        - GET /api/v1/cust/uuid-123

4. Customer details load             → EntityFormContainer renders
   (Blue border, sticky header)        - Shows: Customer name, address, contact
                                        - Status badge, tier, opportunity funnel
                                        - Read-only mode (view from workflow context)
                                        - Customer's own dl__client_status also shown
                                          with its own DAG visualization

5. Clicks "Task" node                → handleStateClick(3)
                                        - GET /api/v1/task/{task_id}
                                        - Shows: Task name, assignee, priority
                                        - Task's dl__task_stage shown with DAG:
                                          Backlog → Planning → To Do → In Progress ✓
```

**Key UX Features**:
- Horizontal flow makes workflow progression intuitive
- Arrows show dependencies clearly
- Nested DAGs: Workflow entities have their own stage progressions
- Read-only prevents accidental modifications from workflow view
- Sticky headers keep context visible when scrolling

---

## 7. Critical Considerations When Building

### Database Schema Rules

**CRITICAL: parent_ids MUST be Array**
```sql
-- ✅ CORRECT (enables horizontal layout):
'[
  {"id": 0, "name": "Lead", "parent_ids": [], "color_code": "blue"},
  {"id": 1, "name": "Qualified", "parent_ids": [0], "color_code": "cyan"},
  {"id": 2, "name": "Proposal", "parent_ids": [1], "color_code": "yellow"}
]'::jsonb

-- ❌ WRONG (causes vertical stacking, no arrows):
'[
  {"id": 0, "name": "Lead", "parent_id": null, "color_code": "blue"},
  {"id": 1, "name": "Qualified", "parent_id": 0, "color_code": "cyan"}
]'::jsonb
```

**Why This Matters**:
- DAGVisualizer's topological sort requires `Array.isArray(parent_ids)` checks
- Singular `parent_id` gets parsed as single value, not iterable
- Empty `parent_ids: []` marks root nodes (layer 0)
- Non-empty arrays determine dependencies and layering
- Algorithm uses `forEach`, `map`, `includes` on parent_ids

**Migration Script** (if needed):
```bash
# Fix inconsistent parent_id → parent_ids in DDL:
sed -i 's/"parent_id": null/"parent_ids": []/g' db/datalabel.ddl
sed -i 's/"parent_id": \([0-9][0-9]*\)/"parent_ids": [\1]/g' db/datalabel.ddl

# Reimport database:
./tools/db-import.sh
```

### Frontend Implementation Rules

**1. Data Transformation is Parent's Responsibility**
```typescript
// ✅ Parent component handles data transformation
const dagNodes = rawData.map(item => ({
  id: item.graph_id,
  node_name: item.stage_label,
  parent_ids: Array.isArray(item.parent_ids) ? item.parent_ids : []
}));
<DAGVisualizer nodes={dagNodes} currentNodeId={2} />

// ❌ Don't pass raw API data directly
<DAGVisualizer nodes={apiResponse.data} /> // Wrong!
```

**2. Robust parent_ids Handling**
```typescript
// Always ensure parent_ids is array
let parentIds: number[] = [];
if (Array.isArray(item.parent_ids)) {
  parentIds = item.parent_ids;           // Preferred format
} else if (item.parent_id != null) {
  parentIds = [item.parent_id];          // Backward compatibility
}
```

**3. Current Node Matching**
```typescript
// Use Case 1: Match by stage name
const currentNode = nodes.find(n => n.node_name === entity.dl__project_stage);
<DAGVisualizer currentNodeId={currentNode?.id} />

// Use Case 2: Match by current_flag
const currentEntity = workflow_graph_data.find(e => e.current_flag);
<DAGVisualizer currentNodeId={currentEntity?.id} />
```

**4. Node Click Semantics are Context-Specific**
```typescript
// Use Case 1: Update entity stage field
onNodeClick={(nodeId) => {
  const node = nodes.find(n => n.id === nodeId);
  if (node) {
    onChange('dl__task_stage', node.node_name);  // Save stage name
  }
}}

// Use Case 2: Load entity details
onNodeClick={(nodeId) => {
  const entity = findEntityByNodeId(nodeId);
  loadEntityData(entity.entity_name, entity.entity_id);
}}
```

**5. Human-Readable Node Names**
```typescript
// ✅ Use friendly display names
node_name: "Customer"                   // Good
node_name: entityConfig.displayName     // Use entity configuration

// ❌ Don't use technical identifiers
node_name: "cust"                       // Bad (raw entity type)
node_name: "dl__task_stage"             // Bad (field name)
```

### Visual Design Rules

**Node Dimensions** (DAGVisualizer.tsx:146-149):
```typescript
const nodeWidth = 140;
const nodeHeight = 38;
const horizontalSpacing = 80;
const verticalSpacing = 18;
```

**SVG Stroke Precision** (DAGVisualizer.tsx:252-266):
```typescript
<rect
  x={0.5}                          // Offset for precise stroke
  y={0.5}
  width={139}                      // Width - 1 (for stroke)
  height={37}                      // Height - 1
  rx={18.5}
  ry={18.5}
  stroke="#6b7280"
  strokeWidth={1}
  strokeLinejoin="round"           // Smooth corners
  shapeRendering="geometricPrecision"  // Consistent borders
/>
```

**Why These Matter**:
- `x/y offset 0.5px`: Centers 1px stroke on pixel boundary (prevents blurring)
- `width/height -1px`: Accounts for stroke width (prevents overflow)
- `strokeLinejoin="round"`: Eliminates corner artifacts
- `shapeRendering="geometricPrecision"`: Forces consistent rendering across browsers

### API Integration Rules

**Settings API** (`apps/api/src/modules/setting/routes.ts:70-78`):
```typescript
// Always use raw=true for DAG visualization
GET /api/v1/datalabel?name=dl__task_stage&raw=true

// Returns: {data: [{id, name, parent_ids, ...}], datalabel: "..."}
// Without raw=true: Returns flattened structure without parent_ids
```

**Stage Updates** (Entity routes):
```typescript
// Store stage NAME, not ID
PUT /api/v1/project/{id}
Body: {
  "dl__project_stage": "Execution"  // Stage name (string)
}

// ❌ Don't store stage ID
// "dl__project_stage": 2  // Wrong!
```

### Performance Considerations

**Memoization**:
```typescript
// Memoize DAG transformation if data changes frequently
const dagNodes = useMemo(() =>
  rawData.map(item => ({
    id: item.id,
    node_name: item.name,
    parent_ids: item.parent_ids || []
  })),
  [rawData]
);
```

**Lazy Loading**:
```typescript
// Load DAG structure only when needed
useEffect(() => {
  if (isStageField(field.key)) {
    loadDagNodes(field.key).then(setDagNodes);
  }
}, [field.key]);
```

### Testing Checklist

**Visual Verification**:
- [ ] Nodes flow horizontally left-to-right
- [ ] Arrows visible between parent-child nodes
- [ ] No vertical stacking (indicates parent_ids issue)
- [ ] Consistent 1px borders on all sides
- [ ] Current node shows green twinkling dot
- [ ] Completed nodes show gray checkmarks
- [ ] Hover effects work smoothly

**Functional Verification**:
- [ ] Clicking nodes updates entity stage (edit mode)
- [ ] Clicking nodes loads entity details (workflow mode)
- [ ] DAG reflects current entity stage accurately
- [ ] Stage changes persist after save
- [ ] Multiple parent edges render correctly
- [ ] Terminal nodes behave properly

**Data Verification**:
```bash
# Check settings have parent_ids arrays:
./tools/test-api.sh GET "/api/v1/datalabel?name=dl__task_stage&raw=true"
# Verify: "parent_ids": [] or "parent_ids": [0]

# Check entity current stage:
./tools/test-api.sh GET "/api/v1/task/{id}"
# Verify: "dl__task_stage": "In Progress" (string, not number)
```

---

## Summary

The **DAGVisualizer** achieves maximum reusability through:

1. **Minimal Interface**: Three required fields (`id`, `node_name`, `parent_ids`)
2. **Horizontal Layout**: Left-to-right flow with topological layering
3. **Array-Based Dependencies**: `parent_ids: number[]` enables proper edge rendering
4. **Visual Precision**: 1px borders, geometricPrecision, rounded stroke joins
5. **DRY Transformation**: Parent components handle all data preparation
6. **Context-Agnostic**: Works for entity stages AND multi-entity workflows

**Parent Components**:
- **EntityFormContainer**: Entity lifecycle stage management (interactive updates)
- **WorkflowDetailPage**: Multi-entity workflow sequences (read-only inspection)

**Critical Success Factors**:
- Database uses `parent_ids` arrays consistently (never `parent_id` singular)
- Frontend transforms data robustly (handles both formats)
- Visual specs followed precisely (offsets, dimensions, stroke rendering)
- Node names are human-readable (use entityConfig.displayName)
- Current node matching uses `node_name` strings (never numeric IDs)

This separation ensures the visualizer remains pure, reusable, and adaptable to future use cases without modification.
