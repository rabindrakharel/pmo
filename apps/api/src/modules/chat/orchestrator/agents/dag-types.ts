/**
 * DAG Configuration Types
 * Simplified types for agent-based orchestration
 *
 * NOTE: DAGContext structure is defined by global_context_schema in dag.json
 * These are generic TypeScript interfaces - the actual schema comes from dag.json
 */

export interface ConversationSummary {
  customer: string;
  agent: string;
}

/**
 * DAG Context - Dynamic structure based on dag.json global_context_schema
 * The actual fields and structure are defined in dag.json's global_context_schema.core_keys
 */
export type DAGContext = Record<string, any> & {
  // Core fields referenced by dag.json (see global_context_schema)
  [key: string]: any;
};

export interface NodeConfig {
  node_name: string;
  prompt: string;
  example_tone_of_reply?: string;
  node_goal: string;
  context_update?: string;
  default_next_node?: string | null;
  branching_conditions?: Array<{
    condition: string;
    child_node: string;
  }>;
}

export interface AgentProfile {
  role: string;
  responsibilities: string[];
  decision_inputs?: string;
  decision_outputs?: string;
}

export interface GraphConfig {
  entry_node: string;
  end_nodes: string[];
  mandatory_fields?: string[];
  summarization?: {
    enabled: boolean;
    node_name: string;
    trigger: string;
  };
}

export interface DAGConfiguration {
  llm_framework_instructions: {
    architecture: string;
    your_role: string;
    core_principles: string[];
    how_it_works: Record<string, string>;
    example_flow: Record<string, string>;
  };
  AGENT_PROFILE: {
    description: string;
    workflow: string;
    node_navigator_agent: AgentProfile;
    worker_agent: AgentProfile;
    collaboration_flow: Record<string, string>;
    key_principle: string;
  };
  system_config: {
    agent_identity: string;
    default_context_values: Record<string, any>;
  };
  nodes: NodeConfig[];
  global_context_schema: {
    description: string;
    core_keys: Record<string, string>;
  };
  routing_config: {
    description: string;
    llm_routing_instructions: string;
    llm_context_update_instructions: string;
    flag_definitions: Record<string, {
      type: string;
      description: string;
      reset_on: string[];
    }>;
  };
  graph_config: GraphConfig;
}
