/**
 * LangGraph Orchestrator Service
 * Main service for executing multi-agent workflows using LangGraph
 * @module orchestrator/langgraph/langgraph-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import { StateManager } from '../state/state-manager.service.js';
import { MCPAdapterService } from '../../mcp-adapter.service.js';
import {
  LangGraphStateGraphService,
  getLangGraphStateGraphService,
  type LangGraphState,
} from './langgraph-state-graph.service.js';
import type { DebugLogEntry } from './graph-nodes.service.js';
import { DEBUG_LOGS, clearDebugLogs } from './graph-nodes.service.js';

/**
 * LangGraph Orchestrator Service
 * Manages the 14-step conversational AI workflow using LangGraph framework
 */
export class LangGraphOrchestratorService {
  private stateManager: StateManager;
  private mcpAdapter: MCPAdapterService;
  private langGraphService: LangGraphStateGraphService;

  constructor() {
    this.stateManager = new StateManager();
    this.mcpAdapter = new MCPAdapterService();
    this.langGraphService = getLangGraphStateGraphService(this.mcpAdapter);

    console.log('[LangGraphOrchestrator] 🚀 Initialized with LangGraph framework');
    console.log(
      '[LangGraphOrchestrator] Graph definition:',
      JSON.stringify(this.langGraphService.getGraphDefinition(), null, 2)
    );
  }

  /**
   * Process a user message through the LangGraph orchestrator
   */
  async processMessage(args: {
    sessionId?: string;
    message: string;
    chatSessionId?: string;
    userId?: string;
    authToken?: string;
  }): Promise<{
    sessionId: string;
    response: string;
    intent: string;
    currentNode: string;
    requiresUserInput: boolean;
    completed: boolean;
    conversationEnded: boolean;
    endReason?: string;
    engagingMessage?: string;
    debugLogs?: DebugLogEntry[];
  }> {
    try {
      clearDebugLogs();
      let sessionId = args.sessionId;
      let existingState: Partial<LangGraphState> | undefined;

      if (!sessionId) {
        // New session
        sessionId = uuidv4();
        console.log(`[LangGraphOrchestrator] 🆕 New session ${sessionId}`);

        // Create session in database
        await this.stateManager.createSession({
          session_id: sessionId,
          chat_session_id: args.chatSessionId,
          user_id: args.userId,
          current_intent: 'CalendarBooking',
          current_node: 'I_greet_customer',
          auth_metadata: { authToken: args.authToken },
        });
      } else {
        // Existing session - load state from LangGraph checkpointer
        console.log(`[LangGraphOrchestrator] 📂 Resuming session ${sessionId}`);
        existingState = (await this.langGraphService.getConversationHistory(sessionId)) || undefined;
      }

      // Process through LangGraph (nodes are state-aware and handle their own logic)
      const result = await this.langGraphService.processMessage(
        sessionId,
        args.message,
        args.authToken || '',
        existingState
      );

      // Save state to database for backup
      await this.saveLangGraphState(sessionId, result);

      // Update session
      await this.stateManager.updateSession(sessionId, {
        current_node: result.current_node || 'I_greet_customer',
        status: result.completed ? 'completed' : 'active',
      });

      // Auto-disconnect voice if conversation ended
      if (result.conversation_ended && args.chatSessionId) {
        try {
          const { disconnectVoiceLangraphSession } = await import('../../voice-langraph.service.js');
          const disconnected = disconnectVoiceLangraphSession(args.chatSessionId);

          if (disconnected) {
            console.log(
              `📞 Voice session ${args.chatSessionId} auto-disconnected (${result.end_reason})`
            );
          }
        } catch (error) {
          console.error('Error disconnecting voice session:', error);
        }
      }

      // Get last assistant message
      const lastAssistantMessage = result.messages
        .filter((m) => m._getType() === 'ai')
        .slice(-1)[0];

      const response = lastAssistantMessage?.content.toString() || '';

      return {
        sessionId,
        response,
        intent: 'CalendarBooking',
        currentNode: result.current_node || 'I_greet_customer',
        requiresUserInput: !result.conversation_ended,
        completed: result.completed || false,
        conversationEnded: result.conversation_ended || false,
        endReason: result.end_reason,
        engagingMessage: undefined,
        debugLogs: DEBUG_LOGS.length > 0 ? [...DEBUG_LOGS] : undefined,
      };
    } catch (error: any) {
      console.error('[LangGraphOrchestrator] ❌ Error processing message:', error);
      throw error;
    }
  }

  /**
   * Save LangGraph state to database (backup for persistence)
   */
  private async saveLangGraphState(sessionId: string, state: LangGraphState): Promise<void> {
    // Convert messages to simple format for database
    const messagesSimple = state.messages.map((msg) => ({
      role: msg._getType() === 'human' ? 'user' : 'assistant',
      content: msg.content.toString(),
    }));

    const stateToSave: Record<string, any> = {
      messages: messagesSimple,
      context: state.context,
      customer_profile: state.customer_profile,
      proposed_actions: state.proposed_actions,
      approved_actions: state.approved_actions,
      executed_actions: state.executed_actions,
      completed: state.completed,
      conversation_ended: state.conversation_ended,
      end_reason: state.end_reason,
      _workflow_state: state.current_node,
      _langgraph_enabled: true,
    };

    for (const [key, value] of Object.entries(stateToSave)) {
      if (value !== undefined && value !== null && value !== '') {
        await this.stateManager.setState(sessionId, key, value, {
          source: 'langgraph',
          node_context: state.current_node,
          validated: true,
        });
      }
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<any> {
    const session = await this.stateManager.getSession(sessionId);
    if (!session) {
      return null;
    }

    const state = await this.stateManager.getAllState(sessionId);
    const logs = await this.stateManager.getAgentLogs(sessionId);

    return {
      session,
      state,
      logs: logs.slice(0, 10), // Last 10 logs
    };
  }

  /**
   * List all available intents
   */
  listIntents(): Array<{ name: string; description: string }> {
    return [
      { name: 'CalendarBooking', description: 'Service appointment booking workflow' },
    ];
  }
}

/**
 * Singleton instance
 */
let instance: LangGraphOrchestratorService | null = null;

export function getLangGraphOrchestratorService(): LangGraphOrchestratorService {
  if (!instance) {
    instance = new LangGraphOrchestratorService();
  }
  return instance;
}
