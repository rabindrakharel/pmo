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

    // Calculate positions (HORIZONTAL LEFT-TO-RIGHT)
    const layerWidth = 120;  // Horizontal spacing between layers
    const nodeHeight = 60;   // Vertical spacing within layers

    console.log('[DAGVisualizer] Layers calculated:', Array.from(nodesByLayer.entries()).map(([layer, nodes]) => ({
      layer,
      nodeCount: nodes.length,
      nodeNames: nodes.map(n => n.node_name)
    })));

    nodesByLayer.forEach((layerNodes, layer) => {
      const totalHeight = layerNodes.length * nodeHeight;
      const startY = (200 - totalHeight) / 2; // Center vertically in 200px height

      layerNodes.forEach((node, index) => {
        const pos = {
          x: layer * layerWidth + 40,  // Horizontal position (left to right)
          y: startY + index * nodeHeight + 40,  // Vertical position within layer
          layer
        };
        console.log(`[DAGVisualizer] Node "${node.node_name}" at layer ${layer}, position (${pos.x}, ${pos.y})`);
        positions.set(node.id, pos);
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
            x1={parentPos.x + 35} // Right edge of parent ellipse
            y1={parentPos.y}      // Center of parent ellipse
            x2={nodePos.x - 35}   // Left edge of child ellipse
            y2={nodePos.y}        // Center of child ellipse
            stroke={isActive ? '#3B82F6' : '#E5E7EB'}
            strokeWidth={isActive ? 2 : 1}
            strokeDasharray={isActive ? '' : '5,5'}
            markerEnd="url(#arrowhead)"
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
          className={onNodeClick ? 'cursor-pointer' : ''}
          onClick={() => onNodeClick?.(node.id)}
        >
          {/* Elliptical node (small horizontal oval) */}
          <ellipse
            cx={pos.x}
            cy={pos.y}
            rx={35}  // Horizontal radius (width)
            ry={18}  // Vertical radius (height) - creates horizontal oval
            className={
              isCurrent
                ? 'fill-blue-500 stroke-blue-700'
                : isCompleted
                  ? 'fill-green-100 stroke-green-500'
                  : 'fill-white stroke-gray-300'
            }
            strokeWidth={isCurrent ? 2 : 1}
          />
          {/* Node label (centered in ellipse) */}
          <text
            x={pos.x}
            y={pos.y + 4}  // Slight offset for vertical centering
            textAnchor="middle"
            className={
              isCurrent
                ? 'fill-white text-xs font-medium'
                : 'fill-gray-700 text-xs'
            }
            style={{ pointerEvents: 'none' }}
          >
            {nodeName.length > 12 ? `${nodeName.substring(0, 10)}...` : nodeName}
          </text>
        </g>
      );
    });
  };

  // Calculate SVG dimensions for horizontal layout
  const maxX = Math.max(...Array.from(positionMap.values()).map(p => p.x)) + 80;
  const maxY = Math.max(...Array.from(positionMap.values()).map(p => p.y)) + 60;
  const svgHeight = Math.max(200, maxY);
  const svgWidth = Math.max(400, maxX);

  return (
    <div className="w-full overflow-x-auto p-4 bg-gray-50 rounded-lg">
      <svg
        width={svgWidth}
        height={svgHeight}
        className="min-h-[150px]"
      >
        {/* Arrowhead marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#3B82F6"
            />
          </marker>
        </defs>

        {renderConnections()}
        {renderNodes()}
      </svg>
    </div>
  );
}