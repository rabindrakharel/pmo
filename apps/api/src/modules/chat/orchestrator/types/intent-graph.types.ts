/**
 * Intent Graph Type Definitions
 * Declarative workflow templates for multi-agent orchestration
 * @module orchestrator/types/intent-graph
 */

/**
 * Intent Graph - Declarative workflow definition
 */
export interface IntentGraph {
  /** Unique intent identifier (e.g., 'CalendarBooking', 'ComplaintHandling') */
  name: string;

  /** Human-readable description */
  description: string;

  /** Version of this graph */
  version: string;

  /** Initial node to start from */
  startNode: string;

  /** All nodes in this graph */
  nodes: Record<string, GraphNode>;

  /** Global boundaries and constraints */
  boundaries: GraphBoundaries;

  /** Required permissions/scopes */
  requiredPermissions?: string[];
}

/**
 * Graph Node - A single step in the workflow
 */
export interface GraphNode {
  /** Node identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what happens at this node */
  description: string;

  /** Which agent(s) handle this node */
  agentRoles: AgentRole[];

  /** Required state variables for this node */
  requiredState?: string[];

  /** State variables this node produces */
  producesState?: string[];

  /** Actions to execute at this node */
  actions: NodeAction[];

  /** Validation rules (checked by Evaluator) */
  validations?: NodeValidation[];

  /** Transitions to other nodes */
  transitions: NodeTransition[];

  /** Whether this node requires explicit user confirmation */
  requiresUserConfirmation?: boolean;

  /** Natural language templates for responses */
  responseTemplates?: ResponseTemplate[];
}

/**
 * Node Action - What to do at a node
 */
export interface NodeAction {
  type: 'mcp_call' | 'collect_data' | 'present_options' | 'confirm' | 'summarize';

  /** MCP tool name (if type='mcp_call') */
  mcpTool?: string;

  /** Input parameter mapping from state */
  inputMapping?: Record<string, string>;

  /** Output mapping to state */
  outputMapping?: Record<string, string>;

  /** Data to collect (if type='collect_data') */
  collectFields?: Array<{
    key: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'object';
    required: boolean;
    prompt?: string;
    validation?: string; // Regex or expression
  }>;

  /** Natural language prompt for the user */
  prompt?: string;
}

/**
 * Node Validation - Rules checked by Evaluator
 */
export interface NodeValidation {
  /** Validation type */
  type: 'required_fields' | 'data_format' | 'business_rule' | 'mcp_success';

  /** Fields to validate */
  fields?: string[];

  /** Validation expression or rule */
  rule?: string;

  /** Error message if validation fails */
  errorMessage: string;

  /** Whether this is a blocking validation */
  blocking?: boolean;
}

/**
 * Node Transition - How to move to the next node
 */
export interface NodeTransition {
  /** Target node ID */
  toNode: string;

  /** Condition for this transition (JavaScript expression) */
  condition?: string;

  /** Is this the default transition? */
  isDefault?: boolean;

  /** Description of when this transition occurs */
  description?: string;
}

/**
 * Response Template - Natural language responses
 */
export interface ResponseTemplate {
  /** When to use this template */
  condition?: string;

  /** Template string with {{variable}} placeholders */
  template: string;

  /** Tone/style guidance */
  tone?: 'professional' | 'empathetic' | 'casual' | 'urgent';
}

/**
 * Graph Boundaries - What the workflow must/must not do
 */
export interface GraphBoundaries {
  /** Topics that are allowed */
  allowedTopics: string[];

  /** Topics that must be rejected */
  forbiddenTopics: string[];

  /** Maximum conversation turns before escalation */
  maxTurns?: number;

  /** Whether the workflow can be paused and resumed */
  canPause?: boolean;

  /** Whether the workflow can be cancelled */
  canCancel?: boolean;

  /** Custom boundary rules (checked by Critic) */
  customRules?: string[];
}

/**
 * Agent Roles
 */
export type AgentRole =
  | 'authenticator'
  | 'orchestrator'
  | 'worker'
  | 'evaluator'
  | 'critic';

/**
 * Agent Action Result
 */
export interface AgentActionResult {
  success: boolean;
  agentRole: AgentRole;
  action: string;
  naturalResponse?: string;
  stateUpdates?: Record<string, any>;
  error?: string;
  nextNode?: string;
  requiresUserInput?: boolean;
  engagingMessage?: string; // Message to show while agent is working
  shouldEndConversation?: boolean; // Signal to end conversation
  endReason?: 'completed' | 'off_topic' | 'max_turns' | 'user_requested'; // Reason for ending
}

/**
 * Intent Detection Result
 */
export interface IntentDetectionResult {
  intent: string;
  confidence: number;
  reasoning?: string;
  fallbackToIntent?: string;
}
