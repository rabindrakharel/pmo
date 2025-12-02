# DAG Visualizer Component

**Version:** 12.0.0 | **Library:** ReactFlow + dagre | **Location:** `apps/web/src/components/workflow/DAGVisualizer.tsx`

---

## Overview

The DAG (Directed Acyclic Graph) Visualizer provides workflow stage visualization using **ReactFlow** with automatic layout via **dagre**. It renders `dl__*_stage` fields as an interactive graph with color-coded nodes and curved edges.

**Core Principles:**
- Pure presentation component (no API calls)
- Format-at-read: transforms DAGNode[] → ReactFlow format in `useMemo`
- Backend metadata drives rendering
- Stages from datalabel store (cached at login via TanStack Query + Dexie)
- Custom node component with handles for edge connections

---

## Libraries & Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| `@xyflow/react` | v12+ | ReactFlow - Interactive graph rendering, nodes, edges, handles |
| `@dagrejs/dagre` | v1.1.8 | Automatic DAG layout algorithm (hierarchical positioning) |
| `@tanstack/react-query` | v5+ | Cache management for datalabel data |
| `dexie` | v4+ | IndexedDB persistence |
| `tailwindcss` | v4 | Node styling (pill shapes, colors, borders) |

### Import Pattern

```typescript
// ReactFlow components
import {
  ReactFlow,
  Node,
  Edge,
  Position,
  Handle,              // Required for custom nodes with edges
  useNodesState,
  useEdgesState,
  Background,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Dagre for layout (CommonJS/ESM compatibility)
import dagre from '@dagrejs/dagre';
const Graph = dagre.graphlib.Graph;  // Extract Graph class
```

---

## Architectural Truth (v12.0.0)

**Metadata properties control DAGVisualizer:**

| Metadata | Property | Purpose |
|----------|----------|---------|
| **viewType** | `renderType: 'component'` + `component: 'DAGVisualizer'` | Controls WHICH component renders (view mode) |
| **viewType** | `lookupField` | Field name for stage data lookup (v12.0.0) |
| **editType** | `inputType: 'select'` + `component: 'BadgeDropdownSelect'` | Controls WHICH component renders (edit mode) |
| **editType** | `lookupSourceTable: 'datalabel'` + `lookupField` | Controls WHERE data comes from (v12.0.0) |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  METADATA → COMPONENT RENDERING (v12.0.0)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  viewType.dl__project_stage:                                                 │
│  ┌────────────────────────────────────────┐                                  │
│  │ renderType: "component"                │──┐                               │
│  │ component: "DAGVisualizer"             │──┼──► viewVizContainer           │
│  │ lookupField: "dl__project_stage"       │──┼──► Key for getDatalabelSync() │
│  └────────────────────────────────────────┘  │                               │
│                                              │                               │
│                                              ▼                               │
│          EntityInstanceFormContainer_viz_container: {                        │
│            view: "DAGVisualizer"   ◄── VIEW mode switch                     │
│          }                                                                   │
│                                              │                               │
│                                              ▼                               │
│          if (vizContainer?.view === 'DAGVisualizer') {                       │
│            return <DAGVisualizer nodes={...} />                              │
│          }                                                                   │
│                                                                              │
│  editType.dl__project_stage:                                                 │
│  ┌────────────────────────────────────────┐                                  │
│  │ inputType: "select"                    │──┐                               │
│  │ component: "BadgeDropdownSelect"       │──┼──► editVizContainer           │
│  │ lookupSourceTable: "datalabel"         │──┼──► Filter for loading options │
│  │ lookupField: "dl__project_stage"       │──► Key for useDatalabel()        │
│  └────────────────────────────────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Property Naming (v12.0.0)

| Old Name (< v12.0.0) | New Name (v12.0.0+) | Location | Purpose |
|----------------------|---------------------|----------|---------|
| `lookupSource` | `lookupSourceTable` | editType | Where to load options: `'datalabel'` or `'entityInstance'` |
| `datalabelKey` | `lookupField` | viewType + editType | Field name for lookup (e.g., `'dl__project_stage'`) |

---

## Props Interface

```typescript
export interface DAGNode {
  id: number;           // Unique node identifier (from datalabel)
  node_name: string;    // Display label (stage name)
  parent_ids: number[]; // Array of parent node IDs (DAG structure)
}

interface DAGVisualizerProps {
  /**
   * DAG nodes to display - REQUIRED
   * Must be provided by parent component from preloaded datalabel cache
   * No API calls should be made by this component
   */
  nodes: DAGNode[];

  /**
   * Current node ID (the active stage)
   * Used to determine completed/current/pending states
   */
  currentNodeId?: number;

  /**
   * Callback when a node is clicked (for edit mode)
   * Receives the clicked node's ID
   */
  onNodeClick?: (nodeId: number) => void;
}
```

---

## Cache & Data Flow Pattern (v12.0.0)

### TanStack Query + Dexie Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CACHE ARCHITECTURE (v12.0.0 - TanStack Query + Dexie)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. LOGIN: Datalabels fetched once via GET /api/v1/datalabel/all        │
│     └── prefetchAllMetadata() called                                    │
│     └── Stored in TanStack Query cache (in-memory)                      │
│     └── Persisted to Dexie IndexedDB (survives browser restart)         │
│     └── Sync cache populated for getDatalabelSync()                     │
│                                                                          │
│  2. COMPONENT MOUNT: EntityInstanceFormContainer reads from cache       │
│     └── getDatalabelSync(lookupField)                                   │
│     └── SYNCHRONOUS read (no API call)                                  │
│     └── Returns: DatalabelOption[] with parent_ids                      │
│                                                                          │
│  3. TRANSFORMATION: EntityInstanceFormContainer transforms to DAGNode[] │
│     └── useMemo for memoization                                         │
│     └── Stored in dagNodes Map<string, DAGNode[]>                       │
│                                                                          │
│  4. RENDER: DAGVisualizer receives nodes as props                       │
│     └── Pure presentation (no cache access)                             │
│     └── useMemo transforms to ReactFlow format                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LOGIN → CACHE → COMPONENT → VISUALIZER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  GET /api/v1/datalabel/all                                              │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────┐                                        │
│  │ TanStack Query Cache        │◄──── queryFn transforms array→record   │
│  │ ['datalabel', key] = [...]  │                                        │
│  └──────────────┬──────────────┘                                        │
│                 │                                                        │
│                 ▼                                                        │
│  ┌─────────────────────────────┐                                        │
│  │ Dexie IndexedDB             │◄──── Persistent storage                │
│  │ datalabel table             │                                        │
│  └──────────────┬──────────────┘                                        │
│                 │                                                        │
│                 ▼                                                        │
│  ┌─────────────────────────────┐                                        │
│  │ Sync Cache (in-memory)      │◄──── For getDatalabelSync()            │
│  └──────────────┬──────────────┘                                        │
│                 │                                                        │
│                 ▼                                                        │
│  EntityInstanceFormContainer                                             │
│  └── getDatalabelSync(lookupField)                                      │
│  └── transformToDAGNodes(options)                                       │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────┐                                        │
│  │ DAGVisualizer               │◄──── Pure presentation                 │
│  │ nodes={transformedNodes}    │                                        │
│  └─────────────────────────────┘                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Integration Code

```typescript
// EntityInstanceFormContainer.tsx - useMemo for datalabel → DAGNode transformation
const { labelsMetadata, dagNodes } = useMemo(() => {
  const dagNodesMap = new Map<string, DAGNode[]>();

  // v12.0.0: Filter by lookupSourceTable
  const fieldsNeedingDatalabels = fields.filter(
    field => field.lookupSourceTable === 'datalabel'
  );

  fieldsNeedingDatalabels.forEach((field) => {
    // v12.0.0: Use lookupField for cache lookup
    const lookupField = field.lookupField || field.key;
    const cachedOptions = getDatalabelSync(lookupField);

    if (cachedOptions && vizContainer?.view === 'DAGVisualizer') {
      const nodes = transformDatalabelToDAGNodes(cachedOptions);
      dagNodesMap.set(field.key, nodes);
    }
  });

  return { labelsMetadata, dagNodes: dagNodesMap };
}, [fields]);  // Recomputes when fields change
```

---

## Visual Design

### Node States

| State | Background | Border | Text | Shadow |
|-------|------------|--------|------|--------|
| **Current** | `bg-blue-500` | `border-gray-400` | `text-white` | `shadow-lg shadow-blue-200` |
| **Completed** | `bg-green-100` | `border-gray-400` | `text-green-800` | none |
| **Pending** | `bg-white` | `border-gray-300` | `text-gray-700` | none |

### Edge States

| State | Stroke Color | Style | Width | Arrow |
|-------|--------------|-------|-------|-------|
| **Traversed** | `#3B82F6` (blue) | Solid | 2px | Blue filled |
| **Not Traversed** | `#9CA3AF` (gray) | Dotted (`5,5`) | 1px | Gray filled |

### Custom Node Component

```typescript
function StageNode({ data }: { data: StageNodeData }) {
  return (
    <div className="px-4 py-2 rounded-full border-2 min-w-[80px] text-center font-medium text-sm">
      {/* Left handle for incoming edges (target) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-transparent !border-0 !w-2 !h-2"
      />
      {label}
      {/* Right handle for outgoing edges (source) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-transparent !border-0 !w-2 !h-2"
      />
    </div>
  );
}
```

**Important:** Custom nodes MUST include `<Handle>` components for edges to connect. Without handles, ReactFlow will log: `Couldn't create edge for source handle id: "null"`.

---

## Layout Configuration

### Dagre Settings

```typescript
dagreGraph.setGraph({
  rankdir: 'LR',      // Left-to-right horizontal layout
  nodesep: 20,        // Vertical spacing between nodes in same rank
  ranksep: 40,        // Horizontal spacing between ranks (stages)
  marginx: 10,        // Graph margin X
  marginy: 10,        // Graph margin Y
});

const NODE_WIDTH = 120;   // Node width for layout calculation
const NODE_HEIGHT = 40;   // Node height for layout calculation
```

### ReactFlow Settings

```typescript
<ReactFlow
  fitView                           // Auto-fit graph to container
  fitViewOptions={{
    padding: 0.15,                  // Padding around graph
    minZoom: 0.3,                   // Allow zoom out to fit all nodes
    maxZoom: 1.5,                   // Max zoom level
    includeHiddenNodes: true,       // Include all nodes in fit calculation
  }}
  nodesDraggable={false}            // Disable node dragging
  nodesConnectable={false}          // Disable connection editing
  elementsSelectable={false}        // Disable selection
  panOnDrag={false}                 // Disable panning
  zoomOnScroll={false}              // Disable scroll zoom
  zoomOnPinch={false}               // Disable pinch zoom
  zoomOnDoubleClick={false}         // Disable double-click zoom
  preventScrolling={false}          // Allow page scroll over component
  proOptions={{ hideAttribution: true }}  // Hide ReactFlow watermark
>
  <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#E5E7EB" />
</ReactFlow>
```

---

## Edge Creation Logic

Edges are created from `parent_ids` array in each DAGNode:

```typescript
// Transform parent_ids → ReactFlow Edge[]
dagNodes.forEach((node) => {
  (node.parent_ids || []).forEach((parentId) => {
    // Determine if edge is on the "active" path (traversed)
    const isActive =
      completedNodes.has(parentId) &&
      (completedNodes.has(node.id) || node.id === currentNodeId);

    rfEdges.push({
      id: `e${parentId}-${node.id}`,
      source: String(parentId),
      target: String(node.id),
      type: 'default',              // Bezier curve (smooth curves)
      animated: false,
      style: {
        stroke: isActive ? '#3B82F6' : '#9CA3AF',
        strokeWidth: isActive ? 2 : 1,
        strokeDasharray: isActive ? '0' : '5,5',  // Solid vs dotted
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isActive ? '#3B82F6' : '#9CA3AF',
        width: 16,
        height: 16,
      },
    });
  });
});
```

---

## Integration with EntityInstanceFormContainer

```typescript
// EntityInstanceFormContainer.tsx

// 1. Check if field uses DAGVisualizer (metadata-driven)
const vizContainer = field.EntityInstanceFormContainer_viz_container;
if (vizContainer?.view === 'DAGVisualizer' && dagNodes.has(field.key)) {

  // 2. Get pre-transformed nodes from dagNodes Map
  const nodes = dagNodes.get(field.key)!;

  // 3. Find current node by matching stage name to value
  const currentNode = nodes.find(n => n.node_name === value);

  // 4. Render DAGVisualizer
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-dark-600">Current Stage:</span>
        {renderFieldBadge(field.key, value || 'Not Set')}
      </div>
      <DAGVisualizer
        nodes={nodes}
        currentNodeId={currentNode?.id}
        onNodeClick={(nodeId) => {
          const node = nodes.find(n => n.id === nodeId);
          if (node) onChange(field.key, node.node_name);
        }}
      />
    </div>
  );
}
```

---

## API Response Example

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
          "lookupField": "dl__project_stage",
          "behavior": { "visible": true }
        }
      },
      "editType": {
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "select",
          "component": "BadgeDropdownSelect",
          "lookupSourceTable": "datalabel",
          "lookupField": "dl__project_stage",
          "behavior": { "editable": true }
        }
      }
    }
  }
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/components/workflow/DAGVisualizer.tsx` | DAG visualization component |
| `apps/api/src/services/pattern-mapping.yaml` | `dl__*_stage` → `datalabel_dag` mapping |
| `apps/api/src/services/view-type-mapping.yaml` | DAG view configuration |
| `apps/api/src/services/edit-type-mapping.yaml` | Badge dropdown edit configuration |
| `apps/web/src/db/cache/hooks/useDatalabel.ts` | TanStack Query datalabel hooks |
| `apps/web/src/db/tanstack-index.ts` | `getDatalabelSync()` export |
| `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx` | DAG integration |

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Fetching stages in DAGVisualizer | Use datalabel cache from store via props |
| Pattern detection (`dl__*_stage`) | Check `viewType[key].component === 'DAGVisualizer'` |
| Using `parent_id` (singular) | Use `parent_ids` array only |
| Custom nodes without handles | Always include `<Handle type="target">` and `<Handle type="source">` |
| `import * as dagre` | Use `import dagre from '@dagrejs/dagre'` + `dagre.graphlib.Graph` |
| Hardcoded stage positions | Use dagre auto-layout |
| Animated edges for all states | Only animate active/traversed edges (or use solid vs dotted) |
| Using old property names | Use `lookupSourceTable` and `lookupField` (v12.0.0) |

---

## Troubleshooting

### Edges Not Appearing

**Error:** `Couldn't create edge for source handle id: "null"`

**Cause:** Custom node component missing `<Handle>` elements.

**Fix:** Add handles to custom node:
```typescript
<Handle type="target" position={Position.Left} />
<Handle type="source" position={Position.Right} />
```

### `dagre.Graph is not a constructor`

**Cause:** ESM/CommonJS import mismatch with `@dagrejs/dagre`.

**Fix:** Extract Graph from `dagre.graphlib`:
```typescript
import dagre from '@dagrejs/dagre';
const Graph = dagre.graphlib.Graph;
// Then use: new Graph()
```

### Nodes Not Visible / Cut Off

**Cause:** Container too small or fitView settings too restrictive.

**Fix:** Adjust fitViewOptions:
```typescript
fitViewOptions={{
  padding: 0.15,
  minZoom: 0.3,  // Lower = more zoom out allowed
  includeHiddenNodes: true,
}}
```

### Datalabel Options Not Loading

**Cause:** Using old property names or sync cache not populated.

**Fix (v12.0.0):**
```typescript
// Ensure prefetchAllMetadata() called at login
await prefetchAllMetadata();

// Use correct property names
const lookupField = editMeta?.lookupField;           // NOT datalabelKey
const lookupSourceTable = editMeta?.lookupSourceTable; // NOT lookupSource

// Access via sync cache
const options = getDatalabelSync(lookupField);
```

---

## Migration from v8.x to v12.0.0

```typescript
// Before (v8.x)
const lookupSource = editMeta?.lookupSource;      // ❌ Old name
const datalabelKey = editMeta?.datalabelKey;      // ❌ Old name
const options = useDatalabelMetadataStore
  .getState()
  .getDatalabel(datalabelKey);                    // ❌ Zustand store

// After (v12.0.0)
const lookupSourceTable = editMeta?.lookupSourceTable;  // ✅ New name
const lookupField = editMeta?.lookupField;              // ✅ New name
const options = getDatalabelSync(lookupField);          // ✅ TanStack sync cache

// Or with hook
const { options } = useDatalabel(lookupField);          // ✅ TanStack Query hook
```

---

**Last Updated:** 2025-12-02 | **Version:** 12.0.0 | **Status:** Production Ready

**Recent Updates:**
- v12.0.0 (2025-12-02):
  - Renamed `lookupSource` → `lookupSourceTable`
  - Renamed `datalabelKey` → `lookupField`
  - Migrated from Zustand to TanStack Query + Dexie
  - Updated all code examples with v12.0.0 property names
  - Added Migration section
  - Added Troubleshooting for datalabel loading issues
- v2.3.0 (2025-11-27):
  - Added `<Handle>` components to custom nodes for edge connections
  - Fixed dagre import: `dagre.graphlib.Graph` for ESM compatibility
  - Updated edge styling: dotted gray for pending, solid blue for traversed
  - Reduced node spacing: `nodesep: 20`, `ranksep: 40`
  - Changed edge type to `default` (bezier curves)
- v2.2.0 (2025-11-27):
  - Added "Architectural Truth" section documenting viewType/editType separation
