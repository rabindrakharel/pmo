/**
 * DAGVisualizer - Reusable DAG graph visualization component
 *
 * FIXED: Component now receives all data via props
 * - No API calls
 * - No data fetching
 * - Pure presentation component
 * - Parent components provide nodes from preloaded data
 */
import type { ReactElement } from 'react';

export interface DAGNode {
  id: number;
  node_name: string;
  parent_ids: number[];
}

interface NodePosition {
  x: number;
  y: number;
  layer: number;
}

interface DAGVisualizerProps {
  /**
   * DAG nodes to display - REQUIRED
   * Must be provided by parent component from preloaded data
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

export function DAGVisualizer({
  nodes,
  currentNodeId,
  onNodeClick
}: DAGVisualizerProps) {
  // ============================================================================
  // FIXED: Use props directly, no API calls
  // ============================================================================
  // DAGVisualizer should NEVER make API calls
  // All data comes from props passed by parent components
  // The backend already includes datalabel data in the response

  // Validate required props
  if (!nodes || nodes.length === 0) {
    console.warn('[DAGVisualizer] No nodes provided via props');
    return null;
  }

  // Use the nodes and currentNodeId directly from props
  const visibleNodes = nodes;
  const visibleCurrentNodeId = currentNodeId;

  // Find all ancestor nodes of the current node (completed nodes)
  const findCompletedNodes = (): Set<number> => {
    const completed = new Set<number>();
    if (visibleCurrentNodeId === undefined) return completed;

    const visited = new Set<number>();
    const queue: number[] = [visibleCurrentNodeId];

    // BFS to find all ancestors
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = visibleNodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Add all parents as completed
      node.parent_ids.forEach(parentId => {
        completed.add(parentId);
        queue.push(parentId);
      });
    }

    return completed;
  };

  const completedNodes = findCompletedNodes();

  // Calculate node positions
  const calculateNodePositions = (): Map<number, NodePosition> => {
    const positions = new Map<number, NodePosition>();
    const nodesByLayer = new Map<number, DAGNode[]>();
    const nodeLayers = new Map<number, number>();

    // Build adjacency list for children
    const childrenMap = new Map<number, number[]>();
    visibleNodes.forEach(node => {
      node.parent_ids.forEach(parentId => {
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(node.id);
      });
    });

    // Find root nodes (nodes with no parents)
    const rootNodes = visibleNodes.filter(node => node.parent_ids.length === 0);

    // Assign layers using BFS
    const queue: { node: DAGNode; layer: number }[] = rootNodes.map(node => ({ node, layer: 0 }));
    const visited = new Set<number>();

    while (queue.length > 0) {
      const { node, layer } = queue.shift()!;

      if (visited.has(node.id)) continue;
      visited.add(node.id);

      nodeLayers.set(node.id, layer);

      // Add to layer grouping
      if (!nodesByLayer.has(layer)) {
        nodesByLayer.set(layer, []);
      }
      nodesByLayer.get(layer)!.push(node);

      // Process children
      const children = childrenMap.get(node.id) || [];
      children.forEach(childId => {
        const childNode = visibleNodes.find(n => n.id === childId);
        if (childNode && !visited.has(childId)) {
          queue.push({ node: childNode, layer: layer + 1 });
        }
      });
    }

    // Calculate positions
    const layerWidth = 160;
    const nodeHeight = 80;

    nodesByLayer.forEach((layerNodes, layer) => {
      const totalHeight = layerNodes.length * nodeHeight;
      const startY = (400 - totalHeight) / 2; // Center vertically in 400px height

      layerNodes.forEach((node, index) => {
        positions.set(node.id, {
          x: layer * layerWidth + 50,
          y: startY + index * nodeHeight,
          layer
        });
      });
    });

    return positions;
  };

  const positionMap = calculateNodePositions();

  // Render connections between nodes
  const renderConnections = () => {
    const connections: ReactElement[] = [];

    visibleNodes.forEach(node => {
      const nodePos = positionMap.get(node.id);
      if (!nodePos) return;

      node.parent_ids.forEach(parentId => {
        const parentPos = positionMap.get(parentId);
        if (!parentPos) return;

        const key = `${parentId}-${node.id}`;
        const isActive = completedNodes.has(parentId) && (completedNodes.has(node.id) || node.id === visibleCurrentNodeId);

        connections.push(
          <line
            key={key}
            x1={parentPos.x + 100} // Right side of parent
            y1={parentPos.y + 25}  // Middle of parent
            x2={nodePos.x}         // Left side of child
            y2={nodePos.y + 25}    // Middle of child
            stroke={isActive ? '#3B82F6' : '#E5E7EB'}
            strokeWidth={isActive ? 2 : 1}
            strokeDasharray={isActive ? '' : '5,5'}
          />
        );
      });
    });

    return connections;
  };

  // Render nodes
  const renderNodes = () => {
    return visibleNodes.map(node => {
      const pos = positionMap.get(node.id);
      if (!pos) return null;

      const isCurrent = visibleCurrentNodeId !== undefined && node.id === visibleCurrentNodeId;
      const isCompleted = completedNodes.has(node.id);

      // Get node_name with fallback
      const nodeName = node.node_name || 'Unknown';

      return (
        <g
          key={node.id}
          transform={`translate(${pos.x}, ${pos.y})`}
          className={onNodeClick ? 'cursor-pointer' : ''}
          onClick={() => onNodeClick?.(node.id)}
        >
          <rect
            width={100}
            height={50}
            rx={6}
            className={
              isCurrent
                ? 'fill-blue-500'
                : isCompleted
                  ? 'fill-green-100 stroke-green-500'
                  : 'fill-white stroke-gray-300'
            }
            strokeWidth={isCurrent ? 2 : 1}
          />
          <text
            x={50}
            y={30}
            textAnchor="middle"
            className={
              isCurrent
                ? 'fill-white text-sm font-medium'
                : 'fill-gray-700 text-sm'
            }
          >
            {nodeName}
          </text>
        </g>
      );
    });
  };

  // Calculate SVG dimensions
  const maxX = Math.max(...Array.from(positionMap.values()).map(p => p.x)) + 150;
  const maxY = Math.max(...Array.from(positionMap.values()).map(p => p.y)) + 100;
  const svgHeight = Math.max(400, maxY);
  const svgWidth = Math.max(600, maxX);

  return (
    <div className="w-full h-full overflow-auto p-4 bg-gray-50 rounded-lg">
      <svg
        width={svgWidth}
        height={svgHeight}
        className="min-h-[400px]"
      >
        {renderConnections()}
        {renderNodes()}
      </svg>
    </div>
  );
}