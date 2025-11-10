/**
 * Agent Configuration Schema v3.0
 * Goal-oriented agentic architecture with declarative configuration
 *
 * @module orchestrator/config/agent-config-schema
 * @version 3.0.0
 */

/**
 * Main configuration structure for v3.0
 */
export interface AgentConfigV3 {
  version: '3.0.0';
  architecture: 'goal-oriented-agentic';
  goals: ConversationGoal[];
  agent_profiles: Record<string, AgentProfile>;
  conversation_tactics: Record<string, ConversationTactic>;
  global_constraints: GlobalConstraints;
}

/**
 * Conversation Goal - Represents a business objective
 * Goals replace the old node-based system
 */
export interface ConversationGoal {
  goal_id: string;
  description: string;
  goal_type?: string;
  is_terminal?: boolean;
  primary_agent?: string;
  fallback_agent?: string;

  // Success criteria (supports both old and new naming)
  success_criteria?: SuccessCriteria;
  goal_success_criteria?: GoalSuccessCriteria;

  // Agent configuration
  allowed_agents?: string[];
  agent_profile?: AgentProfile;  // Single unified agent profile per goal

  // MCP tool boundary - limits which tools are available for this goal
  mcp_tool_boundary?: string[];

  // Field collection (replaces extraction schema in agent profiles)
  field_collection_order?: string[];
  field_validation?: Record<string, FieldValidation>;

  // Available tools (legacy)
  available_tools?: string[];

  // Conversation tactics
  conversation_tactics: string[];
  max_turns: number;

  // Goal transitions
  fallback_goal?: string;
  auto_advance_conditions?: AdvanceCondition[];  // Deprecated - use goal_branching_condition
  goal_branching_condition?: GoalBranchingCondition;

  // Constraints and termination
  constraints?: Constraint[];
  termination_sequence?: TerminationSequence;

  // Execution strategy (deprecated - single agent per goal now)
  agent_execution_strategy?: AgentExecutionStrategy;

  // Retry strategy (deprecated - handled by orchestrator)
  retry_strategy?: RetryStrategy;

  // Examples for LLM learning
  examples?: ConversationExample[];
}

/**
 * Agent Execution Strategy - Defines how agents run for this goal
 * Parallel execution can dramatically improve performance
 */
export interface AgentExecutionStrategy {
  // Execution mode
  mode: 'sequential' | 'parallel' | 'dependency_graph';

  // For parallel mode: agents that can run simultaneously
  parallel_groups?: ParallelAgentGroup[];

  // For dependency_graph mode: execution order based on dependencies
  execution_graph?: AgentExecutionNode[];
}

export interface ParallelAgentGroup {
  agents: string[];  // Agent IDs that run in parallel
  description?: string;
}

export interface AgentExecutionNode {
  agent: string;
  depends_on?: string[];  // Agent IDs this agent depends on
  required: boolean;  // If false, failure doesn't stop execution
}

/**
 * Termination Sequence - Declarative steps for ending conversation
 * Used by terminal goals to specify goodbye message and MCP cleanup
 */
export interface TerminationSequence {
  enabled: boolean;
  steps: TerminationStep[];
  on_completion: 'END';
}

export interface TerminationStep {
  step: number;
  action: 'conversational_goodbye' | 'execute_mcp_hangup' | 'custom';
  agent: string;
  message_template?: string;
  required_tool?: string;
  description?: string;
  tactics?: string[];
}

/**
 * Success criteria for goal completion (legacy)
 */
export interface SuccessCriteria {
  mandatory_fields: string[];
  conditional_fields?: Record<string, string[]>;
  quality_checks?: string[];
  field_collection_order?: string[];  // Added for backward compatibility
}

/**
 * Goal Success Criteria (new format)
 * Uses JSON path conditions for deterministic validation
 */
export interface GoalSuccessCriteria {
  all_of?: GoalCondition[];
  any_of?: GoalCondition[];
  evaluation_mode?: 'deterministic' | 'semantic';
}

/**
 * Goal condition for success criteria and branching
 */
export interface GoalCondition {
  json_path: string;
  operator: 'is_set' | 'is_not_set' | 'is_empty' | '==' | '!=' | '>' | '<' | '>=' | '<=';
  value?: string | number | boolean;
}

/**
 * Goal Branching Condition
 * Replaces auto_advance_conditions with unified branching logic
 */
export interface GoalBranchingCondition {
  type: 'deterministic' | 'semantic' | 'hybrid';
  rules: BranchingRule[];
}

/**
 * Branching rule for goal transitions
 */
export interface BranchingRule {
  condition: GoalCondition | string;  // GoalCondition for deterministic, string for semantic
  next_goal: string;
  priority?: number;  // Higher priority rules evaluated first
  loop_prevention?: {
    max_iterations?: number;
    cooldown_turns?: number;
  };
}

/**
 * Field validation configuration
 */
export interface FieldValidation {
  format: 'phone_number' | 'email' | 'street_address' | 'zipcode' | 'url' | 'custom';
  mcp_tool?: string;  // MCP tool to use for validation
  regex?: string;  // Custom regex for validation
  required?: boolean;
}

/**
 * Retry strategy configuration
 */
export interface RetryStrategy {
  approach: 'provide_examples' | 'vary_phrasing' | 'retry_operation' | 'revise_plan' | 'gentle_wrap_up';
  escalation_turns: number[];
  escalation_messages?: string[];
}

/**
 * Conversation example for LLM learning
 */
export interface ConversationExample {
  input: string;
  output: {
    commands_to_run: MCPCommand[];
    ask_talk_reply_to_customer: string;
  };
}

/**
 * MCP command structure in examples
 */
export interface MCPCommand {
  tool: string;
  params: Record<string, any>;
}

/**
 * Conditions for advancing to next goal
 * Supports three types of branching:
 * 1. deterministic: Fast JSON path checks (if field exists, if value > N)
 * 2. semi_deterministic: Field presence checks (if customer.phone is set)
 * 3. semantic: LLM-evaluated natural language conditions (if customer satisfied)
 */
export interface AdvanceCondition {
  // Condition type (deterministic is fastest, semantic is most flexible)
  type?: 'deterministic' | 'semi_deterministic' | 'semantic';

  // For semantic conditions (LLM-evaluated)
  condition?: string;  // Natural language description

  // For deterministic/semi-deterministic conditions (no LLM needed)
  json_path?: string;  // Path in session memory (e.g., "customer.phone", "service.urgency_level")
  operator?: 'is_set' | 'is_not_set' | '==' | '!=' | '>' | '<' | '>=' | '<=';
  value?: string | number | boolean;  // Expected value for comparison

  // Target goal
  next_goal: string;

  // Loop prevention
  loop_prevention?: {
    max_iterations?: number;
    cooldown_turns?: number;
  };
}

/**
 * Agent Profile - Persistent identity and capabilities
 * Agents have consistent behavior across goals
 */
export interface AgentProfile {
  identity: string;
  capabilities: string[];
  system_prompt: string;
  personality_traits?: {
    empathy_level?: 'low' | 'medium' | 'high';
    formality?: 'casual' | 'professional' | 'professional_friendly';
    verbosity?: 'concise' | 'moderate' | 'detailed';
    humor?: 'none' | 'subtle' | 'playful';
  };
  tactics_library?: Record<string, string>;
  extraction_schema?: Record<string, ExtractionField>;
  planning_strategies?: Record<string, string>;
  tool_selection_strategy?: Record<string, string>;
}

/**
 * Extraction field configuration for data extraction agent
 */
export interface ExtractionField {
  type: string;
  extraction_strategy: string;
  validation?: string;  // Optional - not all fields need validation
}

/**
 * Conversation Tactic - Reusable conversation pattern
 * Tactics are selected by agents based on situation
 */
export interface ConversationTactic {
  description: string;
  examples: string[];
  when_to_use: string;
  contraindications: string;
}

/**
 * Global constraints that apply across all goals
 */
export interface GlobalConstraints {
  max_conversation_turns: number;
  max_goal_iterations: number;
  mandatory_fields_global: string[];
  timeout_seconds: number;
  escalation_triggers: string[];
}

/**
 * Constraint for goal transitions (Phase 6)
 */
export interface Constraint {
  constraint_id: string;
  constraint_type: ConstraintType;
  description: string;

  // For field_requirement
  required_fields?: string[];
  validation?: string;

  // For semantic_condition
  semantic_condition?: string;

  // For state_requirement
  required_states?: string[];

  // For quality_check
  quality_criteria?: string[];

  // For temporal_constraint
  max_turns?: number;
  max_duration_seconds?: number;

  // Transitions
  enabled_transitions?: string[];
  disabled_transitions?: string[];

  // Failure handling
  failure_action?: {
    type: 'loop_back' | 'escalate' | 'terminate';
    target_goal?: string;
    max_iterations?: number;
    reason?: string;
  };
}

export type ConstraintType =
  | 'field_requirement'
  | 'semantic_condition'
  | 'state_requirement'
  | 'quality_check'
  | 'temporal_constraint';

/**
 * Hierarchical Context Structure (Phase 4)
 */
export interface ConversationContextV3 {
  session: {
    id: string;
    chat_session_id: string;
    user_id: string;
    started_at: string;
    last_updated: string;
  };

  customer: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    address?: {
      street?: string;
      city?: string;
      postal_code?: string;
    };
    preferences?: {
      contact_method?: 'phone' | 'email' | 'sms';
      language?: string;
    };
  };

  service: {
    primary_request: string;
    secondary_requests?: string[];
    service_category?: string;
    urgency?: 'low' | 'medium' | 'high' | 'emergency';
    preferred_timing?: string;
  };

  operations: {
    task_id?: string;
    task_name?: string;
    project_id?: string;
    appointment?: {
      id?: string;
      scheduled_time?: string;
      employee_id?: string;
      employee_name?: string;
      status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    };
    solution_plan?: string;
    execution_results?: string;
  };

  conversation: {
    current_goal: string;
    completed_goals: string[];
    task_graph?: any;
    history: Array<{
      index: number;
      customer: string;
      agent: string;
      timestamp: string;
      agent_reasoning?: string;
    }>;
    summary?: string;
    sentiment?: {
      current: number;
      trend: 'improving' | 'declining' | 'stable';
    };
  };

  state: {
    mandatory_fields_collected: boolean;
    customer_consent_given: boolean;
    ready_for_execution: boolean;
    resolution_confirmed: boolean;
    call_ended: boolean;
  };

  metadata: {
    total_turns: number;
    total_goals_completed: number;
    llm_tokens_used: number;
    mcp_tools_called: string[];
    estimated_completion_percentage: number;
  };
}

/**
 * Task Graph for dynamic planning (Phase 3)
 */
export interface TaskNode {
  task_id: string;
  goal_id: string;
  description: string;
  dependencies: string[];
  parallel_allowed: boolean;
  estimated_turns: number;
}

export interface TaskGraph {
  root_task: TaskNode;
  tasks: TaskNode[];
  execution_order: string[][];
}

/**
 * Goal transition result
 */
export interface GoalTransitionResult {
  shouldTransition: boolean;
  currentGoal: string;
  nextGoal: string | null;
  reason: string;
  matchedCondition?: string;
  criteriaStatus: CriteriaCheckResult;
}

export interface CriteriaCheckResult {
  met: boolean;
  missing: string[];
  satisfied: string[];
}

/**
 * Type guard to check if config is v3
 */
export function isAgentConfigV3(config: any): config is AgentConfigV3 {
  return config?.version === '3.0.0' && config?.architecture === 'goal-oriented-agentic';
}

/**
 * Validate config structure
 */
export function validateAgentConfigV3(config: AgentConfigV3): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.goals || config.goals.length === 0) {
    errors.push('At least one goal is required');
  }

  if (!config.agent_profiles || Object.keys(config.agent_profiles).length === 0) {
    errors.push('At least one agent profile is required');
  }

  // Validate each goal
  for (const goal of config.goals || []) {
    if (!goal.goal_id) {
      errors.push(`Goal missing goal_id: ${JSON.stringify(goal)}`);
    }
    if (!goal.allowed_agents || goal.allowed_agents.length === 0) {
      errors.push(`Goal ${goal.goal_id} has no allowed_agents`);
    }
    if (!goal.success_criteria) {
      errors.push(`Goal ${goal.goal_id} missing success_criteria`);
    }
  }

  // Validate agent profiles
  for (const [agentId, profile] of Object.entries(config.agent_profiles || {})) {
    if (!profile.identity) {
      errors.push(`Agent profile ${agentId} missing identity`);
    }
    if (!profile.system_prompt) {
      errors.push(`Agent profile ${agentId} missing system_prompt`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
