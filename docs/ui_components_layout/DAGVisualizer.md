# DAG Visualizer Component

**Version:** 2.0.0 | **Library:** ReactFlow + dagre | **Location:** `apps/web/src/components/workflow/DAGVisualizer.tsx`

---

## Overview

The DAG (Directed Acyclic Graph) Visualizer provides workflow stage visualization using **ReactFlow** with automatic layout via **dagre**. It renders `dl__*_stage` fields as an interactive graph with color-coded nodes.

**Core Principles:**
- Pure presentation component (no API calls)
- Format-at-read: transforms DAGNode[] → ReactFlow format in `useMemo`
- Backend metadata drives rendering (`renderType: 'dag'`)
- Stages from datalabel store (cached at login)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DAG VISUALIZER ARCHITECTURE (v2.0.0)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Datalabel Store (Zustand)                     │    │
│  │  datalabelMetadataStore.getDatalabel('dl__project_stage')       │    │
│  │  → { options: [{ id, name, parent_ids, color_code }] }          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              EntityFormContainer (useMemo)                       │    │
│  │  transformDatalabelToDAGNodes(cachedOptions)                    │    │
│  │  → DAGNode[] = [{ id, node_name, parent_ids }]                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    DAGVisualizer (ReactFlow)                     │    │
│  │                                                                  │    │
│  │   ┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐              │    │
│  │   │ Init │────▶│ Plan │────▶│ Exec │────▶│Close │              │    │
│  │   └──────┘     └──────┘     └──────┘     └──────┘              │    │
│  │   (green)      (green)      (blue)       (gray)                │    │
│  │                              ▲                                  │    │
│  │                         (current)                               │    │
│  │                                                                  │    │
│  │  Layout: dagre (left-to-right)                                  │    │
│  │  Rendering: ReactFlow                                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface (v2.0.0)

```typescript
export interface DAGNode {
  id: number;           // Unique node identifier
  node_name: string;    // Display label
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
   */
  currentNodeId?: number;

  /**
   * Callback when a node is clicked (for edit mode)
   */
  onNodeClick?: (nodeId: number) => void;
}
```

---

## Data Flow (Format-at-Read)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FORMAT-AT-READ PATTERN                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Datalabel Store (Zustand, cached at login)                          │
│     datalabelMetadataStore.getDatalabel('dl__project_stage')            │
│     → DatalabelOption[] = [{ id, name, parent_ids, color_code }]        │
│                              │                                          │
│                              v                                          │
│  2. EntityFormContainer (useMemo - memoized transformation)             │
│     transformDatalabelToDAGNodes(options)                               │
│     → DAGNode[] = [{ id, node_name, parent_ids }]                       │
│                              │                                          │
│                              v                                          │
│  3. DAGVisualizer (useMemo - memoized transformation)                   │
│     Transform DAGNode[] → ReactFlow { nodes: Node[], edges: Edge[] }    │
│     Apply dagre layout (left-to-right)                                  │
│     Compute completed/current/pending states                            │
│                              │                                          │
│                              v                                          │
│  4. ReactFlow renders the graph                                         │
│     - Pill-shaped nodes with Tailwind styling                           │
│     - Animated edges for active paths                                   │
│     - Automatic fit-to-view                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Visual States

| State | Color | Description |
|-------|-------|-------------|
| **Current** | Blue (`bg-blue-500`) | Active stage, highlighted with shadow |
| **Completed** | Green (`bg-green-100`) | Ancestors of current node |
| **Pending** | Gray (`bg-white border-gray-300`) | Not yet reached |

### Edge States

| State | Style | Description |
|-------|-------|-------------|
| **Active** | Blue, animated, thick | Path from root to current node |
| **Inactive** | Gray, static, thin | Future paths |

---

## Integration with EntityFormContainer

```typescript
// EntityFormContainer.tsx

// 1. Get datalabel options from cache
const cachedOptions = useDatalabelMetadataStore.getState().getDatalabel(field.key);

// 2. Transform to DAG nodes (memoized)
const transformDatalabelToDAGNodes = (options: DatalabelOption[]): DAGNode[] => {
  return options.map(opt => ({
    id: opt.id,
    node_name: opt.name,
    parent_ids: opt.parent_ids || []  // MUST use parent_ids array
  }));
};

// 3. Render DAGVisualizer
if (field.EntityFormContainer_viz_container === 'DAGVisualizer') {
  const nodes = dagNodes.get(field.key)!;
  const currentNode = nodes.find(n => n.node_name === value);

  return (
    <DAGVisualizer
      nodes={nodes}
      currentNodeId={currentNode?.id}
      onNodeClick={(nodeId) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) onChange(field.key, node.node_name);
      }}
    />
  );
}
```

---

## Technology Stack

| Component | Library | Purpose |
|-----------|---------|---------|
| Graph Rendering | `@xyflow/react` (ReactFlow v12) | Interactive node/edge rendering |
| Layout Algorithm | `@dagrejs/dagre` | Automatic DAG layout calculation |
| Styling | Tailwind CSS | Node appearance (pill shapes, colors) |

---

## Configuration

### Layout Options (dagre)

```typescript
dagreGraph.setGraph({
  rankdir: 'LR',    // Left-to-right layout
  nodesep: 50,      // Horizontal spacing between nodes
  ranksep: 80,      // Vertical spacing between ranks
  marginx: 20,      // Graph margin X
  marginy: 20,      // Graph margin Y
});
```

### ReactFlow Options

```typescript
<ReactFlow
  fitView                      // Auto-fit graph to container
  nodesDraggable={false}       // Disable dragging (embedded use)
  nodesConnectable={false}     // Disable connection editing
  panOnDrag={false}            // Disable panning
  zoomOnScroll={false}         // Disable scroll zoom
  proOptions={{ hideAttribution: true }}
/>
```

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Fetching stages in component | Use datalabel cache from store |
| Pattern detection (`dl__*_stage`) | Check `viewType[key].renderType === 'dag'` |
| Using `parent_id` (singular) | Use `parent_ids` array only |
| Inline SVG rendering | Use ReactFlow components |
| Hardcoded stage positions | Use dagre auto-layout |

---

## Migration from v1.0.0 (Custom SVG)

| v1.0.0 (Custom SVG) | v2.0.0 (ReactFlow) |
|---------------------|-------------------|
| Manual BFS layout calculation | dagre auto-layout |
| `<svg>`, `<ellipse>`, `<line>` | ReactFlow `<Node>`, `<Edge>` |
| Fixed horizontal spacing | Dynamic responsive layout |
| No zoom/pan support | Built-in controls (disabled by default) |
| Custom arrow markers | ReactFlow `MarkerType.ArrowClosed` |

---

**Last Updated:** 2025-11-26 | **Version:** 2.0.0 | **Status:** Production Ready
