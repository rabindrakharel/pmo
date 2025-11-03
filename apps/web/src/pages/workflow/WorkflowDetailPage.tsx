import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { ExitButton } from '../../components/shared/button/ExitButton';
import { SequentialStateVisualizer, StateOption } from '../../components/shared/entity/SequentialStateVisualizer';
import { EntityFormContainer } from '../../components/shared';
import { getEntityConfig } from '../../lib/entityConfig';
import { APIFactory } from '../../lib/api';
import { GitBranch, Loader2 } from 'lucide-react';

interface WorkflowState {
  id: string;
  code: string;
  name: string;
  descr?: string;
  metadata?: any;
  entity_name: string;
  entity_id: string;
  state_id: number;
  state_name: string;
  entity_created_ts?: string;
  entity_updated_ts?: string;
  current_state_flag?: boolean;
  terminal_state_flag?: boolean;
}

export function WorkflowDetailPage() {
  const { instance_id } = useParams<{ instance_id: string }>();
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [workflowGraph, setWorkflowGraph] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<WorkflowState | null>(null);
  const [selectedEntityData, setSelectedEntityData] = useState<any>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (instance_id) {
      loadWorkflowData();
      loadWorkflowGraph();
    }
  }, [instance_id]);

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

  const loadEntityDataForState = async (state: WorkflowState) => {
    try {
      setEntityLoading(true);
      setEntityError(null);
      setSelectedEntityData(null);

      const api = APIFactory.getAPI(state.entity_name);
      const response = await api.get(state.entity_id);
      const entityData = response.data || response;

      setSelectedEntityData(entityData);
    } catch (err) {
      console.error(`Failed to load entity data for ${state.entity_name}:${state.entity_id}`, err);
      setEntityError(err instanceof Error ? err.message : 'Failed to load entity data');
    } finally {
      setEntityLoading(false);
    }
  };

  const handleStateClick = async (stateId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const response = await fetch(`${apiBaseUrl}/api/v1/workflow/${instance_id}/state/${stateId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load state data');
      }

      const stateData = await response.json();
      setSelectedState(stateData);

      // Load entity data for the selected state
      await loadEntityDataForState(stateData);
    } catch (err) {
      console.error('Error loading state:', err);
      setEntityError(err instanceof Error ? err.message : 'Failed to load state data');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !workflowData) {
    return (
      <Layout>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">Error: {error || 'Workflow not found'}</p>
        </div>
      </Layout>
    );
  }

  // Convert workflow graph nodes to StateOption format
  const convertWorkflowGraphToStates = (): StateOption[] => {
    return workflowGraph
      .filter(n => n.id < 90) // Filter out exception states
      .sort((a, b) => a.id - b.id)
      .map(node => ({
        value: node.id,
        label: node.entity_name,
        sort_order: node.id
      }));
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ExitButton />
            <div>
              <div className="flex items-center gap-2">
                <GitBranch className="h-6 w-6 text-gray-600" />
                <h1 className="text-2xl font-semibold text-gray-900">{workflowData.workflow_template_name}</h1>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span>Instance: <span className="font-mono font-medium">{workflowData.workflow_instance_id}</span></span>
                <span>•</span>
                <span>Industry: <span className="font-medium">{workflowData.industry_sector}</span></span>
                {workflowData.customer_entity_id && (
                  <>
                    <span>•</span>
                    <span>Customer: <span className="font-medium">{workflowData.customer_entity_id}</span></span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Graph Visualization */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 text-gray-700 mb-4">
            <GitBranch className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Workflow State Graph</h3>
          </div>
          <SequentialStateVisualizer
            states={convertWorkflowGraphToStates()}
            currentState={String(workflowData.states?.find((s: WorkflowState) => s.current_state_flag)?.state_id || '')}
            mode="horizontal"
            editable={true}
            onStateChange={(stateId) => handleStateClick(Number(stateId))}
          />
        </div>

        {/* Selected State Entity Details */}
        {selectedState && (
          <div className="bg-white border-2 border-blue-500 rounded-lg p-6 shadow-lg">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  State {selectedState.state_id}: {selectedState.state_name}
                </h3>
                {selectedState.current_state_flag && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Current</span>
                )}
                {selectedState.terminal_state_flag && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Terminal</span>
                )}
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div><span className="font-medium">Entity Type:</span> {getEntityConfig(selectedState.entity_name)?.displayName || selectedState.entity_name}</div>
                <div><span className="font-medium">Entity ID:</span> <span className="font-mono text-xs">{selectedState.entity_id}</span></div>
                {selectedState.descr && (
                  <div><span className="font-medium">Description:</span> {selectedState.descr}</div>
                )}
              </div>
            </div>

            {/* Entity Form Container */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {entityLoading && (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading entity data...</span>
                </div>
              )}

              {entityError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  Failed to load entity data: {entityError}
                </div>
              )}

              {selectedEntityData && getEntityConfig(selectedState.entity_name) && (
                <div>
                  <h4 className="text-base font-semibold text-gray-900 mb-4">
                    {getEntityConfig(selectedState.entity_name)?.displayName} Details
                  </h4>
                  <EntityFormContainer
                    data={selectedEntityData}
                    config={getEntityConfig(selectedState.entity_name)!}
                    onFieldChange={() => {}}
                    isEditing={false}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
