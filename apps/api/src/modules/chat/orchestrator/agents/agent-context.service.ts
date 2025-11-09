/**
 * Agent Context Service
 * Pure context management without LangGraph dependencies
 * Manages conversation context based on agent_config.json schema
 * @module orchestrator/agents/agent-context
 */

import type { DAGContext, ConversationSummary, DAGConfiguration } from './dag-types.js';
import { createContextInitializer, type ContextInitializer } from './context-initializer.service.js';

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

  // DAG Context (matches agent_config.json schema)
  context: DAGContext;

  // Current execution state
  currentNode: string;
  previousNode?: string;
  loopBackIntention?: string; // Internal context: why agent is looping back (not shown to customer)

  // Completion status
  completed: boolean;
  conversationEnded: boolean;
  endReason?: string;
}

/**
 * Agent Context Manager
 * Manages context state without LangGraph - DETERMINISTIC from agent_config.json
 */
export class AgentContextManager {
  private dagConfig: DAGConfiguration | null = null;
  private contextInitializer: ContextInitializer | null = null;

  /**
   * Set DAG configuration for deterministic context initialization
   */
  setDAGConfig(config: DAGConfiguration): void {
    this.dagConfig = config;
    this.contextInitializer = createContextInitializer(config);
    console.log('[AgentContextManager] 📋 DAG configuration loaded for deterministic context initialization');
  }

  /**
   * Initialize new context - DETERMINISTIC from agent_config.json
   */
  initializeContext(sessionId: string, chatSessionId?: string, userId?: string, authToken?: string): AgentContextState {
    return {
      sessionId,
      chatSessionId,
      userId,
      authToken,
      messages: [],
      context: this.initializeDAGContext(sessionId),
      currentNode: this.dagConfig?.graph_config?.entry_node || 'GREET_CUSTOMER',
      completed: false,
      conversationEnded: false,
    };
  }

  /**
   * Initialize DAG context with default values - DETERMINISTIC from agent_config.json global_context_schema
   * Uses ContextInitializer service for proper initialization
   */
  private initializeDAGContext(sessionId: string): DAGContext {
    // If ContextInitializer available, use it (preferred)
    if (this.contextInitializer) {
      console.log('[AgentContextManager] ✅ Using ContextInitializer service for proper initialization');
      return this.contextInitializer.initializeContext(sessionId);
    }

    // Fallback if no initializer (shouldn't happen)
    console.warn('[AgentContextManager] ⚠️ ContextInitializer not available, using fallback');
    return this.getFallbackDAGContext(sessionId);
  }


  /**
   * Fallback context initialization if DAG config not available
   */
  private getFallbackDAGContext(sessionId: string): DAGContext {
    return {
      agent_session_id: sessionId,
      who_are_you: 'You are a polite customer service agent who is assisting a customer',
      data_extraction_fields: {
        customer_name: '',
        customer_phone_number: '',
        customer_email: '',
        customer_id: '',
        customers_main_ask: '',
        matching_service_catalog_to_solve_customers_issue: '',
        related_entities_for_customers_ask: '',
        task_id: '',
        task_name: '',
        appointment_details: '',
        project_id: '',
        assigned_employee_id: '',
        assigned_employee_name: '',
      },
      next_course_of_action: '',
      next_node_to_go_to: '',
      node_traversed: [],
      summary_of_conversation_on_each_step_until_now: [],
      flags: {},
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
   * Update context (NON-DESTRUCTIVE MERGE)
   *
   * IMPORTANT BEHAVIOR (per agent_config.json context_update_rules):
   * - Arrays (summary_of_conversation, node_traversal_path): APPENDS new items to existing
   * - Other fields: UPDATES only if new value is meaningful (not undefined/null/empty)
   * - Existing data is NEVER removed, only added to or updated
   *
   * This ensures context is built incrementally across nodes and MCP calls.
   */
  updateContext(state: AgentContextState, updates: Partial<DAGContext>): AgentContextState {
    const merged = { ...state.context };

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'summary_of_conversation_on_each_step_until_now') {
        // ✅ APPEND to conversation summary array (never replace)
        const existing = state.context.summary_of_conversation_on_each_step_until_now || [];
        const newItems = Array.isArray(value) ? value : [value];
        merged.summary_of_conversation_on_each_step_until_now = [...existing, ...newItems];
        console.log(`[AgentContext] 💬 Conversation summary appended: ${newItems.length} item(s), total: ${merged.summary_of_conversation_on_each_step_until_now.length}`);
      } else if (key === 'node_traversed') {
        // ✅ APPEND to node traversal array (never replace)
        const existing = state.context.node_traversed || [];
        const newNodes = Array.isArray(value) ? value : [value];
        merged.node_traversed = [...existing, ...newNodes];
        console.log(`[AgentContext] 🗺️  Node traversed appended: ${newNodes.join(' → ')}, total nodes: ${merged.node_traversed.length}`);
      } else if (key === 'data_extraction_fields') {
        // ✅ MERGE nested data_extraction_fields object (not replace)
        // ✅ IMPROVED: Only merge non-empty values (prevent empty strings from overwriting existing data)
        const existing = state.context.data_extraction_fields || {};
        const updates = value || {};

        // Filter out empty/null/undefined values before merging
        const filteredUpdates = Object.entries(updates).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            acc[k] = v;
          }
          return acc;
        }, {} as any);

        merged.data_extraction_fields = { ...existing, ...filteredUpdates };

        const updatedKeys = Object.keys(filteredUpdates);
        if (updatedKeys.length > 0) {
          console.log(`[AgentContext] 📝 Data extraction fields merged: ${updatedKeys.join(', ')}`);
        } else {
          console.log(`[AgentContext] ℹ️  Data extraction returned no new values (all empty)`);
        }
      } else if (value !== undefined && value !== null && value !== '') {
        // ✅ UPDATE field only if new value is meaningful
        const isNew = !merged[key] || merged[key] === '';
        merged[key] = value;
        console.log(`[AgentContext] 📝 Field updated: ${key} ${isNew ? '[NEW]' : '[UPDATED]'}`);
      }
    }

    return {
      ...state,
      context: merged,
    };
  }

  /**
   * Append conversation exchange to summary
   * Helper method for explicitly appending to conversation history
   * Auto-generates index based on current summary length
   */
  appendConversationSummary(
    state: AgentContextState,
    userMessage: string,
    agentResponse: string
  ): AgentContextState {
    const currentSummary = state.context.summary_of_conversation_on_each_step_until_now || [];
    const nextIndex = currentSummary.length;

    return this.updateContext(state, {
      summary_of_conversation_on_each_step_until_now: [
        {
          index: nextIndex,
          customer: userMessage,
          agent: agentResponse,
        },
      ],
    });
  }

  /**
   * Update current node and append to node traversed array
   */
  updateCurrentNode(state: AgentContextState, nodeName: string): AgentContextState {
    // Add to node traversed array
    const stateWithPath = this.updateContext(state, {
      node_traversed: [nodeName],
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
