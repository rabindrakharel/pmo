/**
 * DAG-based LangGraph Framework - Type Definitions
 * Defines types for DAG nodes, context, routing, and state management
 * @module orchestrator/langgraph/dag-types
 */

/**
 * DAG Node Definition
 */
export interface DAGNode {
  node_name: string;
  prompt: string;
  prompt_templates: string;
  context_data_schema_input_from_node: string;
  node_goal: string;
  context_update: string;
  default_next_node: string | null;
  branching_conditions: BranchingCondition[];
}

/**
 * Branching Condition for routing
 */
export interface BranchingCondition {
  condition: string;
  child_node: string;
}

/**
 * Global Context Schema
 */
export interface GlobalContextSchema {
  description: string;
  core_keys: Record<string, string>;
}

/**
 * Routing Configuration
 */
export interface RoutingConfig {
  description: string;
  variables: {
    issue_change_keywords: string[];
    data_update_keywords: string[];
    consent_yes_keywords: string[];
    consent_no_keywords: string[];
    continue_conversation_keywords: string[];
    end_conversation_keywords: string[];
  };
  flag_definitions: Record<string, FlagDefinition>;
  branching_logic: Record<string, string>;
}

/**
 * Flag Definition
 */
export interface FlagDefinition {
  type: string;
  description: string;
  reset_on: string[];
}

/**
 * System Configuration
 */
export interface SystemConfig {
  agent_identity: string;
  default_context_values: {
    who_are_you: string;
    [key: string]: any;
  };
}

/**
 * Graph Configuration
 */
export interface GraphConfig {
  entry_node: string;
  end_nodes: string[];
  mandatory_fields: string[];
  summarization: {
    enabled: boolean;
    node_name: string;
    trigger: string;
  };
}

/**
 * LLM Framework Instructions
 */
export interface LLMFrameworkInstructions {
  architecture: string;
  your_role: string;
  core_principles: string[];
  how_it_works: Record<string, string>;
  example_flow: Record<string, string>;
}

/**
 * Agent Profile Definition
 */
export interface AgentProfile {
  description?: string;
  workflow?: string;
  node_navigator_agent?: {
    role: string;
    responsibilities?: string[];
    decision_inputs?: string;
    decision_outputs?: string;
  };
  worker_agent?: {
    role: string;
    responsibilities?: string[];
    decision_inputs?: string;
    decision_outputs?: string;
  };
  guider_agent?: {
    role: string;
    responsibilities?: string[];
    decision_inputs?: string;
    decision_outputs?: string;
  };
  collaboration_flow?: Record<string, string>;
  key_principle?: string;
}

/**
 * Complete DAG Configuration
 */
export interface DAGConfiguration {
  llm_framework_instructions?: LLMFrameworkInstructions;
  AGENT_PROFILE?: AgentProfile;
  system_config?: SystemConfig;
  nodes: DAGNode[];
  global_context_schema: GlobalContextSchema;
  routing_config: RoutingConfig;
  graph_config: GraphConfig;
}

/**
 * DAG Context State
 * The evolving context passed through all nodes
 */
export interface DAGContext {
  who_are_you?: string;
  customer_name?: string;
  customer_phone_number?: string;
  customer_id?: string;
  customers_main_ask?: string;
  matching_service_catalog_to_solve_customers_issue?: string;
  related_entities_for_customers_ask?: string[] | string;
  task_id?: string;
  appointment_details?: string;
  next_steps_plans_help_customer?: string;
  next_course_of_action?: string;
  next_node_to_go_to?: string;
  node_traversal_path?: string[];
  execution_results?: string;
  summary_of_conversation_on_each_step_until_now?: ConversationSummary[];
  flags?: Record<string, number>;
  [key: string]: any; // Allow dynamic keys
}

/**
 * Conversation Summary Entry
 */
export interface ConversationSummary {
  customer: string;
  agent: string;
}

/**
 * DAG Execution State
 * Complete state for LangGraph
 */
export interface DAGExecutionState {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  dag_context: DAGContext;
  current_node: string;
  previous_node?: string;
  conversation_ended: boolean;
  completed: boolean;
  end_reason?: string;

  // Internal (not serialized)
  _mcpAdapter?: any;
  _authToken?: string;
  _dagConfig?: DAGConfiguration;
}

/**
 * Node Execution Result
 */
export interface NodeExecutionResult {
  response?: string;
  context_updates: Partial<DAGContext>;
  next_node?: string;
  should_wait_for_user: boolean;
  error?: string;
}

/**
 * Routing Decision
 */
export interface RoutingDecision {
  next_node: string;
  reason: string;
  skip_current: boolean;
}
