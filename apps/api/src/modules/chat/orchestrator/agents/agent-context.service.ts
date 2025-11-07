/**
 * Agent Context Service
 * Pure context management without LangGraph dependencies
 * Manages conversation context based on dag.json schema
 * @module orchestrator/agents/agent-context
 */

import type { DAGContext, ConversationSummary } from '../langgraph/dag-types.js';

/**
 * Message in conversation
 */
export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Complete agent context state
 */
export interface AgentContextState {
  // Session metadata
  sessionId: string;
  chatSessionId?: string;
  userId?: string;
  authToken?: string;

  // Message history
  messages: AgentMessage[];

  // DAG Context (matches dag.json schema)
  context: DAGContext;

  // Current execution state
  currentNode: string;
  previousNode?: string;

  // Completion status
  completed: boolean;
  conversationEnded: boolean;
  endReason?: string;
}

/**
 * Agent Context Manager
 * Manages context state without LangGraph
 */
export class AgentContextManager {
  /**
   * Initialize new context
   */
  initializeContext(sessionId: string, chatSessionId?: string, userId?: string, authToken?: string): AgentContextState {
    return {
      sessionId,
      chatSessionId,
      userId,
      authToken,
      messages: [],
      context: this.initializeDAGContext(),
      currentNode: 'GREET_CUSTOMER',
      completed: false,
      conversationEnded: false,
    };
  }

  /**
   * Initialize DAG context with default values
   */
  private initializeDAGContext(): DAGContext {
    return {
      who_are_you: 'You are a polite customer service agent who is assisting a customer',
      customer_name: '',
      customer_phone_number: '',
      customer_id: '',
      customers_main_ask: '',
      matching_service_catalog_to_solve_customers_issue: '',
      related_entities_for_customers_ask: '',
      task_id: '',
      appointment_details: '',
      next_course_of_action: '',
      next_node_to_go_to: '',
      node_traversal_path: [],
      summary_of_conversation_on_each_step_until_now: [],
      flags: {
        greet_flag: 0,
        ask_need_flag: 0,
        identify_issue_flag: 0,
        empathize_flag: 0,
        rapport_flag: 0,
        data_name_flag: 0,
        data_phone_flag: 0,
        data_email_flag: 0,
        data_address_flag: 0,
        check_customer_flag: 0,
        plan_flag: 0,
        communicate_plan_flag: 0,
        execute_flag: 0,
        tell_execution_flag: 0,
        goodbye_flag: 0,
      },
    };
  }

  /**
   * Add user message
   */
  addUserMessage(state: AgentContextState, content: string): AgentContextState {
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          role: 'user',
          content,
          timestamp: new Date(),
        },
      ],
    };
  }

  /**
   * Add assistant message
   */
  addAssistantMessage(state: AgentContextState, content: string): AgentContextState {
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content,
          timestamp: new Date(),
        },
      ],
    };
  }

  /**
   * Update context (non-destructive merge)
   */
  updateContext(state: AgentContextState, updates: Partial<DAGContext>): AgentContextState {
    const merged = { ...state.context };

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'flags') {
        // Merge flags specifically
        merged.flags = { ...(state.context.flags || {}), ...(value as Record<string, number>) };
      } else if (key === 'summary_of_conversation_on_each_step_until_now') {
        // Append to summary array
        merged.summary_of_conversation_on_each_step_until_now = [
          ...(state.context.summary_of_conversation_on_each_step_until_now || []),
          ...(value as ConversationSummary[]),
        ];
      } else if (key === 'node_traversal_path') {
        // Append to traversal path
        merged.node_traversal_path = [
          ...(state.context.node_traversal_path || []),
          ...(value as string[]),
        ];
      } else if (value !== undefined && value !== null && value !== '') {
        // Non-destructive: only update if new value is meaningful
        merged[key] = value;
      }
    }

    return {
      ...state,
      context: merged,
    };
  }

  /**
   * Set flag value
   */
  setFlag(state: AgentContextState, flagName: string, value: number): AgentContextState {
    return this.updateContext(state, {
      flags: {
        ...state.context.flags,
        [flagName]: value,
      },
    });
  }

  /**
   * Get flag value
   */
  getFlag(state: AgentContextState, flagName: string): number {
    return state.context.flags?.[flagName] || 0;
  }

  /**
   * Check if flag is set (equals 1)
   */
  isFlagSet(state: AgentContextState, flagName: string): boolean {
    return this.getFlag(state, flagName) === 1;
  }

  /**
   * Update current node
   */
  updateCurrentNode(state: AgentContextState, nodeName: string): AgentContextState {
    // Add to traversal path
    const stateWithPath = this.updateContext(state, {
      node_traversal_path: [nodeName],
    });

    return {
      ...stateWithPath,
      previousNode: state.currentNode,
      currentNode: nodeName,
    };
  }

  /**
   * Mark conversation as ended
   */
  endConversation(state: AgentContextState, reason: string): AgentContextState {
    return {
      ...state,
      completed: true,
      conversationEnded: true,
      endReason: reason,
    };
  }

  /**
   * Get last user message
   */
  getLastUserMessage(state: AgentContextState): string | undefined {
    const userMessages = state.messages.filter(m => m.role === 'user');
    return userMessages.length > 0 ? userMessages[userMessages.length - 1].content : undefined;
  }

  /**
   * Get last assistant message
   */
  getLastAssistantMessage(state: AgentContextState): string | undefined {
    const assistantMessages = state.messages.filter(m => m.role === 'assistant');
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].content : undefined;
  }

  /**
   * Convert to plain object for serialization
   */
  toPlainObject(state: AgentContextState): any {
    return {
      sessionId: state.sessionId,
      chatSessionId: state.chatSessionId,
      userId: state.userId,
      messages: state.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      })),
      context: state.context,
      currentNode: state.currentNode,
      previousNode: state.previousNode,
      completed: state.completed,
      conversationEnded: state.conversationEnded,
      endReason: state.endReason,
    };
  }

  /**
   * Restore from plain object
   */
  fromPlainObject(obj: any): AgentContextState {
    return {
      sessionId: obj.sessionId,
      chatSessionId: obj.chatSessionId,
      userId: obj.userId,
      authToken: obj.authToken,
      messages: obj.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
      })),
      context: obj.context,
      currentNode: obj.currentNode,
      previousNode: obj.previousNode,
      completed: obj.completed || false,
      conversationEnded: obj.conversationEnded || false,
      endReason: obj.endReason,
    };
  }
}

/**
 * Singleton accessor
 */
let instance: AgentContextManager | null = null;

export function getAgentContextManager(): AgentContextManager {
  if (!instance) {
    instance = new AgentContextManager();
  }
  return instance;
}
