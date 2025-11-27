/**
 * DAGVisualizer - ReactFlow-based DAG graph visualization component
 *
 * v2.0.0: Replaced custom SVG with ReactFlow for better:
 * - Auto-layout via dagre
 * - Touch/zoom support
 * - Professional node styling
 *
 * FORMAT-AT-READ PATTERN:
 * - Receives DAGNode[] from datalabel cache (via EntityFormContainer)
 * - Transforms to ReactFlow format in useMemo (memoized)
 * - No API calls - pure presentation component
 */
import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Position,
  Handle,
  useNodesState,
  useEdgesState,
  Background,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';

// Extract Graph from dagre.graphlib (CommonJS/ESM compatibility)
const Graph = dagre.graphlib.Graph;

// ============================================================================
// TYPES
// ============================================================================

export interface DAGNode {
  id: number;
  node_name: string;
  parent_ids: number[];
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
   * Callback when a node is clicked
   */
  onNodeClick?: (nodeId: number) => void;
}

// ============================================================================
// CUSTOM NODE COMPONENT
// ============================================================================

interface StageNodeData extends Record<string, unknown> {
  label: string;
  isCurrent: boolean;
  isCompleted: boolean;
  nodeId: number;
}

function StageNode({ data }: { data: StageNodeData }) {
  const { label, isCurrent, isCompleted } = data;

  // Node styling based on state - all nodes have gray border
  const getNodeStyle = () => {
    if (isCurrent) {
      return 'bg-blue-500 text-white border-gray-400 shadow-lg shadow-blue-200';
    }
    if (isCompleted) {
      return 'bg-green-100 text-green-800 border-gray-400';
    }
    return 'bg-white text-gray-700 border-gray-300';
  };

  return (
    <div
      className={`
        px-4 py-2 rounded-full border-2 min-w-[80px] text-center
        font-medium text-sm transition-all cursor-pointer
        hover:shadow-md ${getNodeStyle()}
      `}
    >
      {/* Left handle for incoming edges */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-transparent !border-0 !w-2 !h-2"
      />
      {label.length > 14 ? `${label.substring(0, 12)}...` : label}
      {/* Right handle for outgoing edges */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-transparent !border-0 !w-2 !h-2"
      />
    </div>
  );
}

// Register custom node types
const nodeTypes = {
  stage: StageNode,
};

// ============================================================================
// DAGRE LAYOUT
// ============================================================================

const NODE_WIDTH = 120;
const NODE_HEIGHT = 40;

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'LR'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 20,      // Vertical spacing between nodes (reduced)
    ranksep: 40,      // Horizontal spacing between ranks (reduced for closer nodes)
    marginx: 10,
    marginy: 10,
  });

  // Add nodes to dagre
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DAGVisualizer({
  nodes: dagNodes,
  currentNodeId,
  onNodeClick,
}: DAGVisualizerProps) {
  // ============================================================================
  // FORMAT-AT-READ: Transform DAGNode[] → ReactFlow format (memoized)
  // ============================================================================
  // This transformation happens on READ from the datalabel cache
  // ReactFlow nodes/edges are computed only when dagNodes change
  // ============================================================================

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!dagNodes || dagNodes.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    // Find completed nodes (ancestors of current node)
    const completedNodes = new Set<number>();
    if (currentNodeId !== undefined) {
      const visited = new Set<number>();
      const queue: number[] = [currentNodeId];

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = dagNodes.find((n) => n.id === nodeId);
        if (!node) continue;

        node.parent_ids.forEach((parentId) => {
          completedNodes.add(parentId);
          queue.push(parentId);
        });
      }
    }

    // Transform DAGNode[] → ReactFlow Node[]
    const rfNodes: Node[] = dagNodes.map((node) => ({
      id: String(node.id),
      type: 'stage',
      position: { x: 0, y: 0 }, // Will be set by dagre
      data: {
        label: node.node_name || 'Unknown',
        isCurrent: node.id === currentNodeId,
        isCompleted: completedNodes.has(node.id),
        nodeId: node.id,
      } as StageNodeData,
    }));

    // Transform parent_ids → ReactFlow Edge[]
    const rfEdges: Edge[] = [];
    console.log('[DAGVisualizer] Creating edges from nodes:', dagNodes.map(n => ({
      id: n.id,
      name: n.node_name,
      parent_ids: n.parent_ids
    })));
    dagNodes.forEach((node) => {
      (node.parent_ids || []).forEach((parentId) => {
        const isActive =
          completedNodes.has(parentId) &&
          (completedNodes.has(node.id) || node.id === currentNodeId);

        rfEdges.push({
          id: `e${parentId}-${node.id}`,
          source: String(parentId),
          target: String(node.id),
          type: 'default',  // Bezier curve (loose curve lines)
          animated: false,  // No animation
          style: {
            stroke: isActive ? '#3B82F6' : '#9CA3AF',  // Blue for traversed, gray for others
            strokeWidth: isActive ? 2 : 1,
            strokeDasharray: isActive ? '0' : '5,5',  // Solid for traversed, dotted for others
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

    console.log('[DAGVisualizer] Created edges:', rfEdges.length, rfEdges.map(e => `${e.source}->${e.target}`));

    // Apply dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      rfNodes,
      rfEdges,
      'LR' // Left-to-right horizontal layout
    );

    console.log('[DAGVisualizer] Layouted nodes:', layoutedNodes.length, 'edges:', layoutedEdges.length);
    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
  }, [dagNodes, currentNodeId]);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when props change
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        const nodeData = node.data as StageNodeData;
        onNodeClick(nodeData.nodeId);
      }
    },
    [onNodeClick]
  );

  // Don't render if no nodes
  if (!dagNodes || dagNodes.length === 0) {
    console.warn('[DAGVisualizer] No nodes provided via props');
    return null;
  }

  // Fixed height for consistent display
  const containerHeight = 200;

  return (
    <div
      className="w-full rounded-lg border border-gray-200 bg-gray-50"
      style={{ height: containerHeight }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.15,
          minZoom: 0.3,
          maxZoom: 1.5,
          includeHiddenNodes: true,
        }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#E5E7EB" />
      </ReactFlow>
    </div>
  );
}
