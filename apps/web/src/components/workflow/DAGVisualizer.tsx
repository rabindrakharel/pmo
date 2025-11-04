/**
 * DAGVisualizer - Reusable DAG graph visualization component
 *
 * Minimal data structure passed via props:
 * - id: Node identifier
 * - node_name: Display label shown in the node
 * - parent_ids: Array of parent node IDs for drawing arrows
 *
 * Pure rendering component - all data preparation done by parent.
 */
import type { ReactElement } from 'react';

export interface DAGNode {
  id: number;           // DAG state index (workflow node position)
  node_name: string;    // Entity type name (displayed in node)
  internal_id?: string; // Actual entity_id (UUID) - optional if entity not created yet
  parent_ids: number[]; // Parent DAG state indexes
}

interface NodePosition {
  id: number;
  x: number;
  y: number;
  layer: number;
}

interface DAGVisualizerProps {
  nodes: DAGNode[];
  currentNodeId?: number;  // Highlighted/current node
  onNodeClick?: (nodeId: number) => void;
}

export function DAGVisualizer({ nodes, currentNodeId, onNodeClick }: DAGVisualizerProps) {
  // Use all nodes as-is (parent component handles filtering)
  const visibleNodes = nodes;

  // Find all ancestor nodes of the current node (completed nodes)
  const findCompletedNodes = (): Set<number> => {
    const completed = new Set<number>();
    if (currentNodeId === undefined) return completed;

    const visited = new Set<number>();
    const queue: number[] = [currentNodeId];

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

  // Compute child_ids from parent_ids
  const computeChildren = (): Map<number, number[]> => {
    const childrenMap = new Map<number, number[]>();

    // Initialize empty arrays for all nodes
    visibleNodes.forEach(node => {
      childrenMap.set(node.id, []);
    });

    // Build children from parent relationships
    visibleNodes.forEach(node => {
      node.parent_ids.forEach(parentId => {
        const children = childrenMap.get(parentId) || [];
        children.push(node.id);
        childrenMap.set(parentId, children);
      });
    });

    return childrenMap;
  };

  const childrenMap = computeChildren();

  // Calculate node layers using topological sort
  const calculateLayers = (): Map<number, number> => {
    const layers = new Map<number, number>();
    const inDegree = new Map<number, number>();

    // Initialize in-degrees
    visibleNodes.forEach(node => {
      inDegree.set(node.id, node.parent_ids.length);
    });

    // Start with nodes that have no parents (layer 0)
    const queue: number[] = [];
    visibleNodes.forEach(node => {
      if (inDegree.get(node.id) === 0) {
        layers.set(node.id, 0);
        queue.push(node.id);
      }
    });

    // Process nodes level by level
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const currentLayer = layers.get(nodeId)!;
      const children = childrenMap.get(nodeId) || [];

      // Update children
      children.forEach(childId => {
        const newDegree = (inDegree.get(childId) || 0) - 1;
        inDegree.set(childId, newDegree);

        // Update layer to be max of all parent layers + 1
        const currentChildLayer = layers.get(childId) || 0;
        layers.set(childId, Math.max(currentChildLayer, currentLayer + 1));

        if (newDegree === 0) {
          queue.push(childId);
        }
      });
    }

    return layers;
  };

  // Calculate node positions
  const calculatePositions = (): NodePosition[] => {
    const layers = calculateLayers();
    const nodesByLayer = new Map<number, number[]>();

    // Group nodes by layer
    layers.forEach((layer, nodeId) => {
      if (!nodesByLayer.has(layer)) {
        nodesByLayer.set(layer, []);
      }
      nodesByLayer.get(layer)!.push(nodeId);
    });

    const positions: NodePosition[] = [];
    const nodeWidth = 140;
    const nodeHeight = 38;
    const horizontalSpacing = 80;
    const verticalSpacing = 18;

    // Position nodes
    nodesByLayer.forEach((nodeIds, layer) => {
      nodeIds.forEach((nodeId, indexInLayer) => {
        positions.push({
          id: nodeId,
          x: layer * (nodeWidth + horizontalSpacing),
          y: indexInLayer * (nodeHeight + verticalSpacing),
          layer
        });
      });
    });

    return positions;
  };

  const positions = calculatePositions();
  const positionMap = new Map(positions.map(p => [p.id, p]));

  // Debug logging
  console.log('[DAGVisualizer] Nodes:', visibleNodes);
  console.log('[DAGVisualizer] First node detail:', visibleNodes[0]);
  console.log('[DAGVisualizer] All node parent_ids:', visibleNodes.map(n => ({ id: n.id, parent_ids: n.parent_ids })));
  console.log('[DAGVisualizer] Children map:', Array.from(childrenMap.entries()));
  console.log('[DAGVisualizer] Position map:', Array.from(positionMap.entries()));

  // Calculate SVG dimensions
  const maxX = Math.max(...positions.map(p => p.x)) + 180;
  const maxY = Math.max(...positions.map(p => p.y)) + 50;

  // Render edges
  const renderEdges = () => {
    const edges: ReactElement[] = [];

    console.log('[DAGVisualizer] renderEdges - Starting edge rendering');
    console.log('[DAGVisualizer] renderEdges - visibleNodes count:', visibleNodes.length);

    visibleNodes.forEach(node => {
      const fromPos = positionMap.get(node.id);
      console.log(`[DAGVisualizer] renderEdges - Node ${node.id} position:`, fromPos);
      if (!fromPos) {
        console.warn(`[DAGVisualizer] renderEdges - No position found for node ${node.id}`);
        return;
      }

      const children = childrenMap.get(node.id) || [];
      console.log(`[DAGVisualizer] renderEdges - Node ${node.id} has ${children.length} children:`, children);

      children.forEach(childId => {
        const toPos = positionMap.get(childId);
        if (!toPos) return;

        // Calculate edge path
        const fromX = fromPos.x + 70; // Center of node (140/2)
        const fromY = fromPos.y + 19; // Center of node (38/2)
        const toX = toPos.x;
        const toY = toPos.y + 19;

        // Use cubic bezier for smooth curves
        const midX = (fromX + toX) / 2;
        const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

        console.log(`[DAGVisualizer] Creating edge from ${node.id} to ${childId}:`, { fromX, fromY, toX, toY, path });

        edges.push(
          <path
            key={`edge-${node.id}-${childId}`}
            d={path}
            stroke="#9ca3af"
            strokeWidth={1}
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        );
      });
    });

    console.log(`[DAGVisualizer] Total edges created: ${edges.length}`);
    return edges;
  };

  // Render nodes
  const renderNodes = () => {
    return visibleNodes.map(node => {
      const pos = positionMap.get(node.id);
      if (!pos) return null;

      const isCurrent = currentNodeId !== undefined && node.id === currentNodeId;
      const isCompleted = completedNodes.has(node.id);

      // Get node_name with fallback
      const nodeName = node.node_name || 'Unknown';

      // Truncate long labels
      const maxLength = 18;
      const displayText = nodeName.length > maxLength
        ? nodeName.substring(0, maxLength - 2) + '...'
        : nodeName;

      return (
        <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
          {/* Node oval/pill shape */}
          <rect
            x={0.5}
            y={0.5}
            width={139}
            height={37}
            rx={18.5}
            ry={18.5}
            fill="#ffffff"
            stroke="#6b7280"
            strokeWidth={1}
            strokeLinejoin="round"
            shapeRendering="geometricPrecision"
            className="cursor-pointer transition-all hover:shadow-sm hover:stroke-gray-500"
            onClick={() => onNodeClick?.(node.id)}
          />

          {/* Checkmark for completed nodes */}
          {isCompleted && (
            <g transform="translate(115, 5)">
              <circle cx="8" cy="8" r="8" fill="#9ca3af" />
              <path
                d="M 5 8 L 7 10 L 11 6"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
          )}

          {/* Twinkling green dot for current node */}
          {isCurrent && (
            <g transform="translate(115, 5)">
              {/* Outer glow effect */}
              <circle cx="8" cy="8" r="10" fill="#10b981" opacity="0.3">
                <animate
                  attributeName="r"
                  values="10;14;10"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.3;0;0.3"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Main dot with opacity animation */}
              <circle cx="8" cy="8" r="6" fill="#10b981">
                <animate
                  attributeName="opacity"
                  values="1;0.4;1"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Center white dot */}
              <circle cx="8" cy="8" r="3" fill="#ffffff" />
            </g>
          )}

          {/* Display node_name */}
          <text
            x={70}
            y={25}
            textAnchor="middle"
            fontSize={12}
            fontWeight="500"
            fill={isCurrent ? '#1f2937' : '#6b7280'}
          >
            {displayText}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg p-4">
      <svg width={maxX} height={maxY} className="min-w-full">
        {/* Define arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="2.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,5 L7,2.5 z" fill="#9ca3af" />
          </marker>
        </defs>

        {/* Render edges first (background) */}
        <g>{renderEdges()}</g>

        {/* Render nodes on top */}
        <g>{renderNodes()}</g>
      </svg>
    </div>
  );
}
