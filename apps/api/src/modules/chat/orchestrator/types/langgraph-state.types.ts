/**
 * LangGraph State Definitions
 * State schema for LangGraph-based orchestration
 * @module orchestrator/types/langgraph-state
 */

import { Annotation } from '@langchain/langgraph';

/**
 * Agent roles in multi-agent system
 */
export type AgentRole = 'planner' | 'worker' | 'critic' | 'summarizer' | 'orchestrator';

/**
 * Orchestrator State
 * Main state structure for LangGraph workflow
 */
export interface OrchestratorState {
  /** Session ID */
  sessionId: string;

  /** Chat session ID (optional link to f_customer_interaction) */
  chatSessionId?: string;

  /** Authenticated user ID */
  userId?: string;

  /** Current intent being executed */
  currentIntent: string;

  /** Current node in the graph */
  currentNode: string;

  /** Session status */
  status: 'active' | 'paused' | 'completed' | 'failed';

  /** Key-value state variables */
  variables: Record<string, any>;

  /** Conversation messages */
  messages: ConversationMessage[];

  /** Agent action history */
  agentActions: AgentAction[];

  /** Current user message being processed */
  userMessage?: string;

  /** Natural language response to user */
  naturalResponse?: string;

  /** Engaging message (shown while processing) */
  engagingMessage?: string;

  /** Whether user input is required */
  requiresUserInput: boolean;

  /** Whether workflow is completed */
  completed: boolean;

  /** Whether conversation should end */
  conversationEnded: boolean;

  /** Reason for conversation ending */
  endReason?: 'completed' | 'off_topic' | 'max_turns' | 'user_requested';

  /** Off-topic attempt counter */
  offTopicCount: number;

  /** Turn counter */
  turnCount: number;

  /** Authentication token */
  authToken?: string;

  /** Authentication context */
  authContext?: {
    userId: string;
    tenantId?: string;
    email: string;
    roles: string[];
    permissions: string[];
  };

  /** Error information */
  error?: {
    code: string;
    message: string;
    agentRole?: AgentRole;
  };

  /** Metadata for tracking */
  metadata: {
    startTime: Date;
    lastUpdateTime: Date;
    totalAgentCalls: number;
    totalMcpCalls: number;
  };
}

/**
 * Conversation Message
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  nodeContext?: string;
}

/**
 * Agent Action (for history/audit trail)
 */
export interface AgentAction {
  agentRole: AgentRole;
  action: string;
  nodeContext: string;
  success: boolean;
  duration?: number;
  mcpTool?: string;
  mcpArgs?: Record<string, any>;
  mcpResult?: any;
  error?: string;
  timestamp: Date;
}

/**
 * LangGraph State Annotation
 * Defines reducer functions for state updates
 */
export const OrchestratorStateAnnotation = Annotation.Root({
  // Session identifiers
  sessionId: Annotation<string>(),
  chatSessionId: Annotation<string | undefined>(),
  userId: Annotation<string | undefined>(),

  // Workflow state
  currentIntent: Annotation<string>(),
  currentNode: Annotation<string>(),
  status: Annotation<'active' | 'paused' | 'completed' | 'failed'>(),

  // Variables - merge updates
  variables: Annotation<Record<string, any>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),

  // Messages - append new messages
  messages: Annotation<ConversationMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // Agent actions - append new actions
  agentActions: Annotation<AgentAction[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // Current processing
  userMessage: Annotation<string | undefined>(),
  naturalResponse: Annotation<string | undefined>(),
  engagingMessage: Annotation<string | undefined>(),

  // Control flags
  requiresUserInput: Annotation<boolean>({ default: () => false }),
  completed: Annotation<boolean>({ default: () => false }),
  conversationEnded: Annotation<boolean>({ default: () => false }),
  endReason: Annotation<'completed' | 'off_topic' | 'max_turns' | 'user_requested' | undefined>(),

  // Counters
  offTopicCount: Annotation<number>({ default: () => 0 }),
  turnCount: Annotation<number>({ default: () => 0 }),

  // Authentication
  authToken: Annotation<string | undefined>(),
  authContext: Annotation<{
    userId: string;
    tenantId?: string;
    email: string;
    roles: string[];
    permissions: string[];
  } | undefined>(),

  // Error handling
  error: Annotation<{
    code: string;
    message: string;
    agentRole?: AgentRole;
  } | undefined>(),

  // Metadata - merge updates
  metadata: Annotation<{
    startTime: Date;
    lastUpdateTime: Date;
    totalAgentCalls: number;
    totalMcpCalls: number;
  }>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({
      startTime: new Date(),
      lastUpdateTime: new Date(),
      totalAgentCalls: 0,
      totalMcpCalls: 0,
    }),
  }),
});

/**
 * Helper type for state updates
 */
export type StateUpdate = Partial<OrchestratorState>;

/**
 * Node execution context
 * Passed to each LangGraph node function
 */
export interface NodeContext {
  state: OrchestratorState;
  graphNode: any; // Reference to intent graph node definition
  mcpAdapter: any; // MCP tool execution service
  stateManager: any; // Database persistence service
}
