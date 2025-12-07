/**
 * WorkflowDetailPage - Display workflow instance with DAG visualization
 *
 * DATA ARCHITECTURE (JSONB Structure):
 * ====================================
 *
 * CORE PRINCIPLE: Only ENTITIES can be nodes in the workflow DAG.
 * Each entity manages its own stage through its dl__%stage field.
 *
 * 1. WORKFLOW TEMPLATE (workflow.workflow_graph)
 *    - Defines workflow structure: sequence of entity types only
 *    - Each node = one entity type (cust, quote, work_order, task, invoice)
 *    - JSONB array: [{id, entity_name, parent_ids}, ...]
 *    - Example: {id: 0, entity_name: "cust", parent_ids: []}
 *               {id: 1, entity_name: "quote", parent_ids: [0]}
 *
 * 2. WORKFLOW INSTANCE (workflow_data.workflow_graph_data)
 *    - ONE row per workflow instance
 *    - All entities stored in workflow_graph_data JSONB array
 *    - Mirrors template structure with actual entity data:
 *      [{id, entity_name, entity_id, entity_label, entity_stage, parent_ids,
 *        current_flag, terminal_flag, entity_created_ts, entity_updated_ts}, ...]
 *    - Example: {id: 0, entity_name: "cust", entity_id: "uuid-123",
 *                entity_label: "John Smith", entity_stage: "qualified_lead", ...}
 *
 * 3. ENTITY STAGES (managed internally by each entity)
 *    - Customer (cust): dl__client_status
 *    - Quote: dl__quote_stage
 *    - Task: dl__task_stage
 *    - Work Order, Invoice: status fields
 *
 * 4. VISUALIZATION:
 *    - DAG shows template structure (entity types and relationships)
 *    - Node labels display entity_label from actual entity data
 *    - Current/terminal flags highlight workflow progress
 *    - Clicking nodes loads full entity details from entity tables
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { ExitButton } from '../../components/shared/button/ExitButton';
import { DAGVisualizer, type DAGNode } from '../../components/workflow/DAGVisualizer';
import { EntityInstanceFormContainer } from '../../components/shared';
import { getEntityConfig } from '../../lib/entityConfig';
import { APIFactory } from '../../lib/api';
import { GitBranch, Loader2, Copy } from 'lucide-react';

// Workflow template node from workflow table
// SIMPLIFIED: Only contains entity type and structure
interface WorkflowTemplateNode {
  id: number;              // State ID in workflow
  entity_name: string;     // Entity type ONLY: cust, quote, work_order, task, invoice
  parent_ids: number[];    // Parent state IDs (workflow structure)
}

// Workflow instance entity from workflow_graph_data JSONB array
// Minimal structure - entity labels fetched dynamically from entity tables
interface WorkflowGraphEntity {
  id: number;              // Node ID (matches template)
  entity_name: string;     // Entity type (cust, quote, work_order, task, invoice)
  entity_id?: string;      // Actual entity UUID (optional if not created yet)
  parent_ids: number[];    // Parent node IDs (from template)
  current_flag?: boolean;  // Is this the current node?
  terminal_flag?: boolean; // Is this a terminal node?
}

export function WorkflowDetailPage() {
  const { instance_id } = useParams<{ instance_id: string }>();
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [workflowGraph, setWorkflowGraph] = useState<WorkflowTemplateNode[]>([]); // Template structure
  const [mergedGraph, setMergedGraph] = useState<DAGNode[]>([]); // Transformed for DAGVisualizer
  const [selectedEntity, setSelectedEntity] = useState<WorkflowGraphEntity | null>(null);
  const [selectedEntityData, setSelectedEntityData] = useState<any>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  // Format relative time
  const formatRelativeTime = (timestamp: string | undefined) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (instance_id) {
      loadWorkflowData();
      loadWorkflowGraph();
    }
  }, [instance_id]);

  // Prepare DAG data from template structure with entity IDs from workflow_graph_data
  // Shows entity TYPES (Customer, Task, etc.) not instance names
  useEffect(() => {
    if (workflowGraph.length > 0 && workflowData) {
      const graphData = workflowData.workflow_graph_data || [];

      const dagNodes = workflowGraph.map((templateNode) => {
        // Find corresponding entity in workflow_graph_data
        const instanceEntity = graphData.find((e: WorkflowGraphEntity) => e.id === templateNode.id);

        // Get entity config for display name
        const entityConfig = getEntityConfig(templateNode.entity_name);
        const displayName = entityConfig?.displayName || templateNode.entity_name;

        return {
          id: templateNode.id,                           // DAG state index
          node_name: displayName,                        // Entity type: "Customer", "Task", etc.
          internal_id: instanceEntity?.entity_id,        // Actual entity UUID (if exists)
          parent_ids: templateNode.parent_ids            // Parent DAG state indexes
        };
      });

      setMergedGraph(dagNodes);
    }
  }, [workflowGraph, workflowData]);

  const loadWorkflowData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const response = await fetch(`${apiBaseUrl}/api/v1/workflow/${instance_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load workflow data');
      }

      const data = await response.json();
      setWorkflowData(data);
    } catch (err) {
      console.error('Error loading workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflowGraph = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const response = await fetch(`${apiBaseUrl}/api/v1/workflow/${instance_id}/graph`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load workflow graph');
      }

      const data = await response.json();
      setWorkflowGraph(data.workflow_graph || []);
    } catch (err) {
      console.error('Error loading workflow graph:', err);
    }
  };

  const loadEntityDataForEntity = async (entity: WorkflowGraphEntity) => {
    try {
      setEntityLoading(true);
      setEntityError(null);
      setSelectedEntityData(null);

      if (!entity.entity_id) {
        setEntityError('Entity ID not found in workflow data.');
        return;
      }

      const api = APIFactory.getAPI(entity.entity_name);
      const response = await api.get(entity.entity_id);
      const entityData = response.data || response;

      setSelectedEntityData(entityData);
    } catch (err) {
      console.error(`Failed to load entity data for ${entity.entity_name}:${entity.entity_id}`, err);
      setEntityError(err instanceof Error ? err.message : 'Failed to load entity data');
    } finally {
      setEntityLoading(false);
    }
  };

  const handleStateClick = async (nodeId: number) => {
    try {
      setEntityError(null);

      // Find entity in workflow_graph_data JSONB array by node id
      const graphData = workflowData?.workflow_graph_data || [];
      const instanceEntity = graphData.find((entity: WorkflowGraphEntity) => entity.id === nodeId);

      if (!instanceEntity) {
        // Entity hasn't been created yet - show template info
        const templateNode = workflowGraph.find(n => n.id === nodeId);
        if (templateNode) {
          setSelectedEntity({
            id: nodeId,
            entity_name: templateNode.entity_name,
            parent_ids: templateNode.parent_ids,
            current_flag: false,
            terminal_flag: false,
          } as WorkflowGraphEntity);
          setEntityError('This entity has not been created in the workflow yet. Showing template information only.');
          setSelectedEntityData(null);
        }
        return;
      }

      // Entity exists - load full entity data using entity_id and entity_name
      setSelectedEntity(instanceEntity);
      if (instanceEntity.entity_id) {
        await loadEntityDataForEntity(instanceEntity);
      } else {
        setEntityError('Entity ID not found in workflow data.');
        setSelectedEntityData(null);
      }
    } catch (err) {
      console.error('Error loading entity:', err);
      setEntityError(err instanceof Error ? err.message : 'Failed to load entity data');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dark-700"></div>
        </div>
      </Layout>
    );
  }

  if (error || !workflowData) {
    return (
      <Layout>
        <div className="p-6 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">Error: {error || 'Workflow not found'}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header - Compact Container Component - Sticky */}
        <div className="sticky top-0 z-10 bg-dark-100 border-b border-dark-300 pb-3 mb-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <ExitButton />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap overflow-x-auto">
              {/* Workflow Name */}
              <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">Workflow:</span>
              <div className="flex items-center gap-1 group">
                <span className="text-dark-600 font-medium text-xs tracking-tight">
                  {workflowData.name}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-dark-100 rounded transition-all duration-200"
                  title="Copy workflow name"
                  onClick={() => copyToClipboard(workflowData.name, 'workflow name')}
                >
                  <Copy className="h-3 w-3 text-dark-600 hover:text-dark-700" />
                </button>
              </div>

              <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>

              {/* Instance Code */}
              <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">code:</span>
              <div className="flex items-center gap-1 group">
                <span className="text-dark-600 font-medium text-xs tracking-tight">
                  {workflowData.workflow_instance_id}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-dark-100 rounded transition-all duration-200"
                  title="Copy code"
                  onClick={() => copyToClipboard(workflowData.workflow_instance_id, 'code')}
                >
                  <Copy className="h-3 w-3 text-dark-600 hover:text-dark-700" />
                </button>
              </div>

              <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>

              {/* ID */}
              <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">id:</span>
              <div className="flex items-center gap-1 group">
                <span className="text-dark-700 font-medium text-xs tracking-tight">
                  {workflowData.id}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-dark-100 rounded transition-all duration-200"
                  title="Copy id"
                  onClick={() => copyToClipboard(workflowData.id, 'id')}
                >
                  <Copy className="h-3 w-3 text-dark-600 hover:text-dark-700" />
                </button>
              </div>

              <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>

              {/* Template */}
              <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">template:</span>
              <span className="text-dark-600 font-medium text-xs tracking-tight">
                {workflowData.workflow_template_name}
              </span>

              <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>

              {/* Industry */}
              <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">industry:</span>
              <span className="text-dark-600 font-medium text-xs tracking-tight">
                {workflowData.industry_sector}
              </span>

              <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>

              {/* Created */}
              <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">created:</span>
              <span className="text-dark-600 font-medium text-xs tracking-tight" title={workflowData.created_ts}>
                {formatRelativeTime(workflowData.created_ts)}
              </span>

              <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>

              {/* Updated */}
              <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">updated:</span>
              <span className="text-dark-600 font-medium text-xs tracking-tight" title={workflowData.updated_ts}>
                {formatRelativeTime(workflowData.updated_ts)}
              </span>
            </div>
          </div>
          </div>
        </div>

        {/* Workflow DAG Visualization */}
        <div className="bg-dark-100 border border-dark-300 rounded-md p-5">
          <div className="flex items-center gap-2 text-dark-700 mb-3">
            <GitBranch className="h-4 w-4" />
            <h3 className="text-sm font-medium">Workflow Entity Graph</h3>
          </div>
          {mergedGraph.length > 0 ? (
            <DAGVisualizer
              nodes={mergedGraph}
              currentNodeId={workflowData?.workflow_graph_data?.find((entity: WorkflowGraphEntity) => entity.current_flag)?.id}
              onNodeClick={handleStateClick}
            />
          ) : (
            <div className="flex items-center justify-center py-8 text-dark-600 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Loading workflow graph...</span>
            </div>
          )}
        </div>

        {/* Selected Entity Details */}
        {selectedEntity && (
          <div className="bg-dark-100 border-2 border-dark-3000 rounded-md shadow-lg">
            {/* Compact Entity Header - Sticky */}
            <div className="sticky top-14 z-10 bg-dark-100 border-b border-dark-300 px-6 pt-6 pb-3">
              <div className="flex items-center gap-2 flex-wrap overflow-x-auto">
              {/* Entity Name */}
              <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">
                {getEntityConfig(selectedEntity.entity_name)?.displayName || selectedEntity.entity_name}:
              </span>
              <div className="flex items-center gap-1 group">
                <span className="text-dark-600 font-medium text-xs tracking-tight">
                  {selectedEntityData?.name || selectedEntity.entity_name}
                </span>
                {selectedEntityData?.name && (
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-dark-100 rounded transition-all duration-200"
                    title="Copy entity name"
                    onClick={() => copyToClipboard(selectedEntityData.name, 'entity name')}
                  >
                    <Copy className="h-3 w-3 text-dark-600 hover:text-dark-700" />
                  </button>
                )}
              </div>

              {selectedEntityData?.code && (
                <>
                  <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>
                  <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">code:</span>
                  <div className="flex items-center gap-1 group">
                    <span className="text-dark-600 font-medium text-xs tracking-tight">
                      {selectedEntityData.code}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-dark-100 rounded transition-all duration-200"
                      title="Copy code"
                      onClick={() => copyToClipboard(selectedEntityData.code, 'code')}
                    >
                      <Copy className="h-3 w-3 text-dark-600 hover:text-dark-700" />
                    </button>
                  </div>
                </>
              )}

              <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>

              {/* Entity ID */}
              <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">id:</span>
              <div className="flex items-center gap-1 group">
                <span className="text-dark-700 font-medium text-xs tracking-tight">
                  {selectedEntity.entity_id || 'Not created yet'}
                </span>
                {selectedEntity.entity_id && (
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-dark-100 rounded transition-all duration-200"
                    title="Copy id"
                    onClick={() => copyToClipboard(selectedEntity.entity_id!, 'id')}
                  >
                    <Copy className="h-3 w-3 text-dark-600 hover:text-dark-700" />
                  </button>
                )}
              </div>

              {selectedEntityData?.created_ts && (
                <>
                  <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>
                  <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">created:</span>
                  <span className="text-dark-600 font-medium text-xs tracking-tight" title={selectedEntityData.created_ts}>
                    {formatRelativeTime(selectedEntityData.created_ts)}
                  </span>
                </>
              )}

              {selectedEntityData?.updated_ts && (
                <>
                  <span className="text-dark-300 flex-shrink-0 mx-0.5 opacity-50">·</span>
                  <span className="text-dark-600 font-medium text-3xs flex-shrink-0 tracking-wide uppercase">updated:</span>
                  <span className="text-dark-600 font-medium text-xs tracking-tight" title={selectedEntityData.updated_ts}>
                    {formatRelativeTime(selectedEntityData.updated_ts)}
                  </span>
                </>
              )}
              </div>
            </div>

            {/* Entity Form Container */}
            <div className="px-6 pb-6 pt-4">
              {entityLoading && (
                <div className="flex items-center justify-center py-8 text-dark-700">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading entity data...</span>
                </div>
              )}

              {entityError && (
                <div className={`p-4 border rounded-md text-sm ${
                  entityError.includes('not been created')
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                  {entityError.includes('not been created') ? (
                    <div>
                      <div className="font-medium mb-1">Future Entity</div>
                      <div>{entityError}</div>
                    </div>
                  ) : (
                    <div>Failed to load entity data: {entityError}</div>
                  )}
                </div>
              )}

              {selectedEntityData && getEntityConfig(selectedEntity.entity_name) && (
                <EntityInstanceFormContainer
                  data={selectedEntityData}
                  config={getEntityConfig(selectedEntity.entity_name)!}
                  onChange={() => {}}
                  isEditing={false}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
