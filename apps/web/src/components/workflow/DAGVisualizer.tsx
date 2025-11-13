/**
 * DAGVisualizer - Reusable DAG graph visualization component
 *
 * NEW ARCHITECTURE: Auto-detects stage/funnel fields and loads DAG structure
 * Can work in two modes:
 * 1. Legacy: Pass nodes array directly
 * 2. Auto: Pass data record, auto-detects stage field and loads DAG
 */
import { useState, useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';

// ============================================================================
// NEW: Universal Field Detector Integration
// ============================================================================
import { generateDAGConfig } from '../../lib/viewConfigGenerator';
import { loadFieldOptions } from '../../lib/settingsLoader';

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
  // ============================================================================
  // NEW ARCHITECTURE: Auto-Generation (Universal Field Detector)
  // ============================================================================
  /**
   * Data record containing stage/funnel field
   * When provided, auto-detects stage field and loads DAG structure
   * @example
   * <DAGVisualizer data={project} />
   * // Auto-detects: dl__project_stage, loads DAG from settings
   */
  data?: Record<string, any>;

  /**
   * Optional: Explicitly specify stage field (overrides auto-detection)
   * @example
   * stageField="dl__project_stage"
   */
  stageField?: string;

  /**
   * Optional data types for auto-generation
   */
  dataTypes?: Record<string, string>;

  // Legacy props (kept for backward compatibility with existing code)
  nodes?: DAGNode[];
  currentNodeId?: number;
  onNodeClick?: (nodeId: number) => void;
}

export function DAGVisualizer({
  data,
  stageField: explicitStageField,
  dataTypes,
  nodes: legacyNodes,
  currentNodeId: legacyCurrentNodeId,
  onNodeClick
}: DAGVisualizerProps) {
  // ============================================================================
  // NEW ARCHITECTURE: Auto-Generation
  // ============================================================================
  const [autoNodes, setAutoNodes] = useState<DAGNode[]>([]);
  const [autoCurrentNodeId, setAutoCurrentNodeId] = useState<number | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-detect stage field using universal field detector
  const detectedConfig = useMemo(() => {
    if (!data) return null;

    const fieldKeys = Object.keys(data);
    return generateDAGConfig(fieldKeys, dataTypes);
  }, [data, dataTypes]);

  // Load DAG structure from settings
  useEffect(() => {
    const loadDAGStructure = async () => {
      if (!data) {
        setAutoNodes([]);
        setAutoCurrentNodeId(undefined);
        return;
      }

      setIsGenerating(true);
      try {
        // Use explicit stageField if provided, otherwise use detected field
        const stageFieldKey = explicitStageField || detectedConfig?.stageField;

        if (!stageFieldKey) {
          console.warn('[DAGVisualizer] No stage field found');
          setAutoNodes([]);
          setAutoCurrentNodeId(undefined);
          return;
        }

        // Extract datalabel from field name (e.g., dl__project_stage → dl__project_stage)
        const datalabel = detectedConfig?.datalabel || stageFieldKey;

        // Load DAG structure from settings
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/api/v1/setting?datalabel=${datalabel}&raw=true`, { headers });
        if (!response.ok) {
          console.error('[DAGVisualizer] Failed to load DAG structure');
          setAutoNodes([]);
          setAutoCurrentNodeId(undefined);
          return;
        }

        const result = await response.json();

        if (result.data && Array.isArray(result.data)) {
          const dagNodes: DAGNode[] = result.data.map((item: any) => {
            let parentIds: number[] = [];
            if (Array.isArray(item.parent_ids)) {
              parentIds = item.parent_ids;
            } else if (item.parent_id !== null && item.parent_id !== undefined) {
              parentIds = [item.parent_id];
            }

            return {
              id: item.id,
              node_name: item.name,
              parent_ids: parentIds
            };
          });

          setAutoNodes(dagNodes);

          // Set current node based on data value
          const currentStageValue = data[stageFieldKey];
          if (currentStageValue) {
            // Find node by name or id
            const currentNode = dagNodes.find(n =>
              n.node_name === currentStageValue || n.id === currentStageValue
            );
            setAutoCurrentNodeId(currentNode?.id);
          }
        } else {
          setAutoNodes([]);
          setAutoCurrentNodeId(undefined);
        }
      } catch (error) {
        console.error('[DAGVisualizer] Error loading DAG structure:', error);
        setAutoNodes([]);
        setAutoCurrentNodeId(undefined);
      } finally {
        setIsGenerating(false);
      }
    };

    loadDAGStructure();
  }, [data, detectedConfig, explicitStageField]);

  // Use auto-generated or legacy nodes
  const visibleNodes = legacyNodes || autoNodes;
  const currentNodeId = legacyCurrentNodeId !== undefined ? legacyCurrentNodeId : autoCurrentNodeId;

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-dark-600">Loading workflow...</p>
      </div>
    );
  }

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

  // Calculate SVG dimensions
  const maxX = Math.max(...positions.map(p => p.x)) + 180;
  const maxY = Math.max(...positions.map(p => p.y)) + 50;

  // Render edges
  const renderEdges = () => {
    const edges: ReactElement[] = [];

    visibleNodes.forEach(node => {
      const fromPos = positionMap.get(node.id);
      if (!fromPos) return;

      const children = childrenMap.get(node.id) || [];

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

        edges.push(
          <path
            key={`edge-${node.id}-${childId}`}
            d={path}
            stroke="#E9E9E7"
            strokeWidth={1}
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        );
      });
    });

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
            fill="#FFFFFF"
            stroke="#E9E9E7"
            strokeWidth={1}
            strokeLinejoin="round"
            shapeRendering="geometricPrecision"
            className="cursor-pointer transition-all hover:shadow-sm hover:stroke-dark-700"
            onClick={() => onNodeClick?.(node.id)}
          />

          {/* Checkmark for completed nodes */}
          {isCompleted && (
            <g transform="translate(115, 5)">
              <circle cx="8" cy="8" r="8" fill="#787774" />
              <path
                d="M 5 8 L 7 10 L 11 6"
                stroke="#FFFFFF"
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
              {/* Center dot */}
              <circle cx="8" cy="8" r="3" fill="#FFFFFF" />
            </g>
          )}

          {/* Display node_name */}
          <text
            x={70}
            y={25}
            textAnchor="middle"
            fontSize={13}
            fontWeight="500"
            fill={isCurrent ? '#37352F' : '#787774'}
          >
            {displayText}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="w-full overflow-x-auto bg-dark-100 rounded-md p-4">
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
            <path d="M0,0 L0,5 L7,2.5 z" fill="#E9E9E7" />
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
