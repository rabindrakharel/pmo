import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Network,
  GitBranch,
  Plus,
  X,
  Check,
  Trash2,
  Zap,
  Search,
  Filter,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Link as LinkIcon,
  Database,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Maximize2,
  Minimize2
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface EntityNode {
  id: string;
  type: string;
  name: string;
  code?: string;
  color: string;
  icon: string;
  x: number;
  y: number;
  connections: number;
  metadata?: any;
}

interface Relationship {
  id: string;
  source: EntityNode;
  target: EntityNode;
  type: string;
  active: boolean;
  color: string;
}

interface LinkageData {
  id: string;
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  relationship_type: string;
  active_flag: boolean;
  created_ts: string;
}

// ============================================================================
// ENTITY CONFIGURATION
// ============================================================================

const ENTITY_TYPES = {
  office: {
    label: 'Office',
    color: '#3B82F6',
    icon: '🏢',
    gradient: 'from-dark-700 to-dark-700'
  },
  business: {
    label: 'Business',
    color: '#8B5CF6',
    icon: '🏪',
    gradient: 'from-purple-500 to-purple-600'
  },
  client: {
    label: 'Client',
    color: '#EC4899',
    icon: '👤',
    gradient: 'from-pink-500 to-pink-600'
  },
  project: {
    label: 'Project',
    color: '#10B981',
    icon: '📋',
    gradient: 'from-emerald-500 to-emerald-600'
  },
  task: {
    label: 'Task',
    color: '#F59E0B',
    icon: '✓',
    gradient: 'from-amber-500 to-amber-600'
  },
  worksite: {
    label: 'Worksite',
    color: '#EF4444',
    icon: '🏗️',
    gradient: 'from-red-500 to-red-600'
  },
  wiki: {
    label: 'Wiki',
    color: '#6366F1',
    icon: '📚',
    gradient: 'from-indigo-500 to-indigo-600'
  },
  artifact: {
    label: 'Artifact',
    color: '#14B8A6',
    icon: '📎',
    gradient: 'from-teal-500 to-teal-600'
  },
  form: {
    label: 'Form',
    color: '#F97316',
    icon: '📝',
    gradient: 'from-orange-500 to-orange-600'
  }
};

const RELATIONSHIP_TYPES = [
  { value: 'contains', label: 'Contains', color: '#3B82F6', icon: '📦' },
  { value: 'owns', label: 'Owns', color: '#8B5CF6', icon: '👑' },
  { value: 'hosts', label: 'Hosts', color: '#EC4899', icon: '🏠' },
  { value: 'assigned_to', label: 'Assigned To', color: '#10B981', icon: '➡️' }
];

// Valid parent-child relationships
const VALID_RELATIONSHIPS: Record<string, string[]> = {
  office: ['business', 'worksite'],
  business: ['project'],
  client: ['project', 'worksite'],
  project: ['task', 'wiki', 'artifact', 'form'],
  task: ['wiki', 'artifact', 'form'],
  worksite: ['task', 'form']
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EntityRelationshipMapper() {
  // State management
  const [nodes, setNodes] = useState<EntityNode[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [linkages, setLinkages] = useState<LinkageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // UI State
  const [selectedNode, setSelectedNode] = useState<EntityNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<EntityNode | null>(null);
  const [draggingNode, setDraggingNode] = useState<EntityNode | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<EntityNode | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  // Canvas state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');

      // Load all linkages
      const linkagesResponse = await fetch('http://localhost:4000/api/v1/linkage', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!linkagesResponse.ok) throw new Error('Failed to load linkages');

      const linkagesData = await linkagesResponse.json();
      const loadedLinkages = linkagesData.data || [];
      setLinkages(loadedLinkages);

      // Build graph from linkages
      await buildGraphFromLinkages(loadedLinkages);

      setSuccess('Relationship map loaded successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to load relationship data');
    } finally {
      setLoading(false);
    }
  };

  const buildGraphFromLinkages = async (linkageData: LinkageData[]) => {
    const nodeMap = new Map<string, EntityNode>();
    const relationshipsArray: Relationship[] = [];

    // Extract unique entities from linkages
    for (const linkage of linkageData) {
      // Parent node
      const parentKey = `${linkage.parent_entity_type}:${linkage.parent_entity_id}`;
      if (!nodeMap.has(parentKey)) {
        const entityData = await fetchEntityDetails(linkage.parent_entity_type, linkage.parent_entity_id);
        nodeMap.set(parentKey, {
          id: linkage.parent_entity_id,
          type: linkage.parent_entity_type,
          name: entityData?.name || 'Unknown',
          code: entityData?.code,
          color: ENTITY_TYPES[linkage.parent_entity_type as keyof typeof ENTITY_TYPES]?.color || '#6B7280',
          icon: ENTITY_TYPES[linkage.parent_entity_type as keyof typeof ENTITY_TYPES]?.icon || '📦',
          x: Math.random() * 800 + 100,
          y: Math.random() * 400 + 100,
          connections: 0,
          metadata: entityData
        });
      }

      // Child node
      const childKey = `${linkage.child_entity_type}:${linkage.child_entity_id}`;
      if (!nodeMap.has(childKey)) {
        const entityData = await fetchEntityDetails(linkage.child_entity_type, linkage.child_entity_id);
        nodeMap.set(childKey, {
          id: linkage.child_entity_id,
          type: linkage.child_entity_type,
          name: entityData?.name || 'Unknown',
          code: entityData?.code,
          color: ENTITY_TYPES[linkage.child_entity_type as keyof typeof ENTITY_TYPES]?.color || '#6B7280',
          icon: ENTITY_TYPES[linkage.child_entity_type as keyof typeof ENTITY_TYPES]?.icon || '📦',
          x: Math.random() * 800 + 100,
          y: Math.random() * 400 + 100,
          connections: 0,
          metadata: entityData
        });
      }

      // Create relationship
      const parentNode = nodeMap.get(parentKey)!;
      const childNode = nodeMap.get(childKey)!;

      parentNode.connections++;
      childNode.connections++;

      const relType = RELATIONSHIP_TYPES.find(rt => rt.value === linkage.relationship_type);

      relationshipsArray.push({
        id: linkage.id,
        source: parentNode,
        target: childNode,
        type: linkage.relationship_type,
        active: linkage.active_flag,
        color: relType?.color || '#6B7280'
      });
    }

    setNodes(Array.from(nodeMap.values()));
    setRelationships(relationshipsArray);
  };

  const fetchEntityDetails = async (entityType: string, entityId: string): Promise<any> => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/${entityType}/${entityId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.data || data;
    } catch (err) {
      console.error(`Failed to fetch ${entityType}:${entityId}`, err);
      return null;
    }
  };

  // ============================================================================
  // CANVAS RENDERING
  // ============================================================================

  useEffect(() => {
    if (viewMode !== 'graph') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply transformations
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(scale, scale);

      // Draw relationships
      relationships.forEach(rel => {
        if (!rel.active && filterType !== 'all') return;

        drawRelationship(ctx, rel);
      });

      // Draw nodes
      nodes.forEach(node => {
        if (filterType !== 'all' && node.type !== filterType) return;
        if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) return;

        drawNode(ctx, node, node === selectedNode, node === hoveredNode);
      });

      // Draw connection line if connecting
      if (connectingFrom) {
        ctx.beginPath();
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(connectingFrom.x, connectingFrom.y);
        ctx.lineTo(lastMousePos.x / scale - offset.x / scale, lastMousePos.y / scale - offset.y / scale);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, relationships, selectedNode, hoveredNode, connectingFrom, scale, offset, filterType, searchTerm, viewMode]);

  const drawNode = (ctx: CanvasRenderingContext2D, node: EntityNode, isSelected: boolean, isHovered: boolean) => {
    const radius = 40;

    // Shadow
    if (isSelected || isHovered) {
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 20;
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

    // Gradient fill
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);
    gradient.addColorStop(0, node.color + 'CC');
    gradient.addColorStop(1, node.color);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? '#FFF' : node.color;
    ctx.lineWidth = isSelected ? 4 : 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Icon
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFF';
    ctx.fillText(node.icon, node.x, node.y);

    // Label
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#1F2937';
    ctx.fillText(node.name, node.x, node.y + radius + 15);

    // Type badge
    ctx.font = '10px Arial';
    ctx.fillStyle = '#6B7280';
    ctx.fillText(ENTITY_TYPES[node.type as keyof typeof ENTITY_TYPES]?.label || node.type, node.x, node.y + radius + 30);

    // Connection count badge
    if (node.connections > 0) {
      const badgeX = node.x + radius - 10;
      const badgeY = node.y - radius + 10;

      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 10px Arial';
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'center';
      ctx.fillText(node.connections.toString(), badgeX, badgeY);
    }
  };

  const drawRelationship = (ctx: CanvasRenderingContext2D, rel: Relationship) => {
    const opacity = rel.active ? '1.0' : '0.3';

    // Arrow
    ctx.beginPath();
    ctx.moveTo(rel.source.x, rel.source.y);

    // Curved line
    const midX = (rel.source.x + rel.target.x) / 2;
    const midY = (rel.source.y + rel.target.y) / 2;
    const cpX = midX;
    const cpY = midY - 50;

    ctx.quadraticCurveTo(cpX, cpY, rel.target.x, rel.target.y);
    ctx.strokeStyle = rel.color + Math.round(parseFloat(opacity) * 255).toString(16).padStart(2, '0');
    ctx.lineWidth = 3;
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(rel.target.y - cpY, rel.target.x - cpX);
    const headlen = 15;

    ctx.beginPath();
    ctx.moveTo(rel.target.x, rel.target.y);
    ctx.lineTo(
      rel.target.x - headlen * Math.cos(angle - Math.PI / 6),
      rel.target.y - headlen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      rel.target.x - headlen * Math.cos(angle + Math.PI / 6),
      rel.target.y - headlen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = rel.color + Math.round(parseFloat(opacity) * 255).toString(16).padStart(2, '0');
    ctx.fill();

    // Label
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#1F2937';
    ctx.textAlign = 'center';
    ctx.fillText(rel.type, cpX, cpY - 10);
  };

  // ============================================================================
  // CANVAS INTERACTIONS
  // ============================================================================

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    // Check if clicking on a node
    const clickedNode = nodes.find(node => {
      const dx = x - node.x;
      const dy = y - node.y;
      return Math.sqrt(dx * dx + dy * dy) < 40;
    });

    if (clickedNode) {
      if (e.shiftKey) {
        // Shift+Click: Start connection
        setConnectingFrom(clickedNode);
      } else {
        // Normal click: Select and start drag
        setSelectedNode(clickedNode);
        setDraggingNode(clickedNode);
      }
    } else {
      // Start panning
      setIsPanning(true);
      setSelectedNode(null);
    }

    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    if (draggingNode) {
      // Drag node
      setNodes(prev => prev.map(node =>
        node === draggingNode
          ? { ...node, x, y }
          : node
      ));
    } else if (isPanning) {
      // Pan canvas
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    } else {
      // Update hover state
      const hoveredNode = nodes.find(node => {
        const dx = x - node.x;
        const dy = y - node.y;
        return Math.sqrt(dx * dx + dy * dy) < 40;
      });
      setHoveredNode(hoveredNode || null);
    }

    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (connectingFrom) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / scale;
      const y = (e.clientY - rect.top - offset.y) / scale;

      const targetNode = nodes.find(node => {
        const dx = x - node.x;
        const dy = y - node.y;
        return Math.sqrt(dx * dx + dy * dy) < 40 && node !== connectingFrom;
      });

      if (targetNode) {
        // Check if relationship is valid
        const validChildren = VALID_RELATIONSHIPS[connectingFrom.type] || [];
        if (validChildren.includes(targetNode.type)) {
          createRelationship(connectingFrom, targetNode);
        } else {
          setError(`Cannot connect ${ENTITY_TYPES[connectingFrom.type as keyof typeof ENTITY_TYPES]?.label} to ${ENTITY_TYPES[targetNode.type as keyof typeof ENTITY_TYPES]?.label}`);
          setTimeout(() => setError(null), 3000);
        }
      }

      setConnectingFrom(null);
    }

    setDraggingNode(null);
    setIsPanning(false);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.1, Math.min(3, prev * delta)));
  };

  // ============================================================================
  // RELATIONSHIP MANAGEMENT
  // ============================================================================

  const createRelationship = async (source: EntityNode, target: EntityNode) => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch('http://localhost:4000/api/v1/linkage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent_entity_type: source.type,
          parent_entity_id: source.id,
          child_entity_type: target.type,
          child_entity_id: target.id,
          relationship_type: 'contains'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create relationship');
      }

      setSuccess(`Created relationship: ${source.name} → ${target.name}`);
      setTimeout(() => setSuccess(null), 3000);

      await loadData();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const deleteRelationship = async (relationshipId: string) => {
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`http://localhost:4000/api/v1/linkage/${relationshipId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete relationship');

      setSuccess('Relationship deleted successfully');
      setTimeout(() => setSuccess(null), 3000);

      await loadData();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gradient-to-br from-dark-100 to-dark-200 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-dark-700 animate-spin mx-auto mb-4" />
          <p className="text-dark-700 font-medium">Loading relationship map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50 bg-dark-100' : 'relative'}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-300 bg-gradient-to-r from-dark-100 to-purple-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-dark-700 to-purple-600 rounded-lg">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark-600">Entity Relationship Mapper</h3>
              <p className="text-sm text-dark-700">
                Visual relationship management • {nodes.length} entities • {relationships.length} connections
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-dark-100 rounded-lg p-1 border border-dark-300">
              <button
                onClick={() => setViewMode('graph')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'graph'
                    ? 'bg-dark-700 text-white shadow-sm'
                    : 'text-dark-700 hover:bg-dark-100'
                }`}
              >
                <Network className="h-4 w-4 inline-block mr-1" />
                Graph
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-dark-700 text-white shadow-sm'
                    : 'text-dark-700 hover:bg-dark-100'
                }`}
              >
                <Database className="h-4 w-4 inline-block mr-1" />
                List
              </button>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 text-dark-700 hover:bg-dark-100 rounded-lg transition-colors"
              title="Filters"
            >
              <Filter className="h-5 w-5" />
            </button>

            <button
              onClick={loadData}
              className="p-2 text-dark-700 hover:bg-dark-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </button>

            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="p-2 text-dark-700 hover:bg-dark-100 rounded-lg transition-colors"
              title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3 animate-pulse">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 flex-1">{success}</p>
            <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="mx-4 mt-4 bg-dark-100 border border-dark-300 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-600" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search entities..."
                    className="w-full pl-10 pr-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-dark-7000 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-600 mb-2">Entity Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-400 rounded-lg focus:ring-2 focus:ring-dark-7000 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  {Object.entries(ENTITY_TYPES).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.icon} {config.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 relative overflow-hidden">
          {viewMode === 'graph' ? (
            <>
              {/* Canvas */}
              <canvas
                ref={canvasRef}
                width={1200}
                height={600}
                className="w-full h-full cursor-move"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onWheel={handleCanvasWheel}
              />

              {/* Instructions Overlay */}
              <div className="absolute top-4 left-4 bg-dark-100/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-dark-300 max-w-xs">
                <h4 className="font-semibold text-dark-600 mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Quick Guide
                </h4>
                <ul className="text-xs text-dark-700 space-y-1">
                  <li>• <strong>Click</strong> to select node</li>
                  <li>• <strong>Drag</strong> to move node</li>
                  <li>• <strong>Shift+Click</strong> to connect nodes</li>
                  <li>• <strong>Scroll</strong> to zoom</li>
                  <li>• <strong>Drag background</strong> to pan</li>
                </ul>
              </div>

              {/* Zoom Controls */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <button
                  onClick={() => setScale(prev => Math.min(3, prev * 1.2))}
                  className="p-2 bg-dark-100 rounded-lg shadow-lg border border-dark-300 hover:bg-dark-100 transition-colors"
                  title="Zoom In"
                >
                  <Plus className="h-5 w-5 text-dark-600" />
                </button>
                <button
                  onClick={() => setScale(1)}
                  className="p-2 bg-dark-100 rounded-lg shadow-lg border border-dark-300 hover:bg-dark-100 transition-colors text-xs font-mono"
                  title="Reset Zoom"
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  onClick={() => setScale(prev => Math.max(0.1, prev * 0.8))}
                  className="p-2 bg-dark-100 rounded-lg shadow-lg border border-dark-300 hover:bg-dark-100 transition-colors"
                  title="Zoom Out"
                >
                  <X className="h-5 w-5 text-dark-600" />
                </button>
              </div>

              {/* Selected Node Info */}
              {selectedNode && (
                <div className="absolute top-4 right-4 bg-dark-100 rounded-lg p-4 shadow-lg border border-dark-300 w-64">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{selectedNode.icon}</span>
                      <div>
                        <h4 className="font-semibold text-dark-600">{selectedNode.name}</h4>
                        <p className="text-xs text-dark-700">{ENTITY_TYPES[selectedNode.type as keyof typeof ENTITY_TYPES]?.label}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-dark-600 hover:text-dark-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-dark-700">Connections:</span>
                      <span className="font-semibold text-dark-600">{selectedNode.connections}</span>
                    </div>
                    {selectedNode.code && (
                      <div className="flex items-center justify-between">
                        <span className="text-dark-700">Code:</span>
                        <span className="font-mono text-xs text-dark-600">{selectedNode.code}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-dark-300">
                    <h5 className="text-xs font-semibold text-dark-600 mb-2">Related Connections</h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {relationships
                        .filter(rel => rel.source.id === selectedNode.id || rel.target.id === selectedNode.id)
                        .map(rel => (
                          <div key={rel.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-dark-100">
                            <span className="text-dark-700 truncate">
                              {rel.source.id === selectedNode.id ? `→ ${rel.target.name}` : `← ${rel.source.name}`}
                            </span>
                            <button
                              onClick={() => deleteRelationship(rel.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* List View */
            <div className="p-4 overflow-auto h-full">
              <div className="bg-dark-100 rounded-lg border border-dark-300 overflow-hidden">
                <table className="min-w-full divide-y divide-dark-400">
                  <thead className="bg-dark-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-dark-700 uppercase">Source</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-dark-700 uppercase">Relationship</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-dark-700 uppercase">Target</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-dark-700 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-dark-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-400">
                    {relationships.map(rel => (
                      <tr key={rel.id} className="hover:bg-dark-100">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{rel.source.icon}</span>
                            <div>
                              <div className="text-sm font-medium text-dark-600">{rel.source.name}</div>
                              <div className="text-xs text-dark-700">{ENTITY_TYPES[rel.source.type as keyof typeof ENTITY_TYPES]?.label}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-100 text-dark-600">
                            {RELATIONSHIP_TYPES.find(rt => rt.value === rel.type)?.icon} {rel.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{rel.target.icon}</span>
                            <div>
                              <div className="text-sm font-medium text-dark-600">{rel.target.name}</div>
                              <div className="text-xs text-dark-700">{ENTITY_TYPES[rel.target.type as keyof typeof ENTITY_TYPES]?.label}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {rel.active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-100 text-dark-600">
                              <X className="h-3 w-3 mr-1" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => deleteRelationship(rel.id)}
                            className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="border-t border-dark-300 bg-dark-100 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-xs font-semibold text-dark-600">Entity Types:</span>
              {Object.entries(ENTITY_TYPES).slice(0, 6).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                  <span className="text-xs text-dark-700">{config.icon} {config.label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-dark-600">Relationships:</span>
              {RELATIONSHIP_TYPES.map(type => (
                <div key={type.value} className="flex items-center gap-1.5">
                  <span className="text-sm">{type.icon}</span>
                  <span className="text-xs text-dark-700">{type.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
