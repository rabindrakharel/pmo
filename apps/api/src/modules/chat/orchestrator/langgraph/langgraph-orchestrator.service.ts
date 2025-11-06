/**
 * LangGraph Orchestrator Service
 * Main service for executing LangGraph-based workflows
 * @module orchestrator/langgraph/langgraph-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import type { OrchestratorState } from '../types/langgraph-state.types.js';
import { createCalendarBookingGraph } from './calendar-booking.langgraph.js';
import { StateManager } from '../state/state-manager.service.js';
import { createPostgresCheckpointer } from './postgres-checkpointer.js';
import { MCPAdapterService } from '../../mcp-adapter.service.js';

/**
 * LangGraph Orchestrator Service
 */
export class LangGraphOrchestratorService {
  private stateManager: StateManager;
  private mcpAdapter: MCPAdapterService;
  private checkpointer: any;
  private graphs: Map<string, any> = new Map();

  constructor() {
    this.stateManager = new StateManager();
    this.mcpAdapter = new MCPAdapterService();
    this.checkpointer = createPostgresCheckpointer(this.stateManager);

    // Initialize graphs
    this.initializeGraphs();
  }

  /**
   * Initialize all available graphs
   */
  private initializeGraphs() {
    // Calendar Booking graph
    const calendarBookingGraph = createCalendarBookingGraph(this.mcpAdapter);
    this.graphs.set('CalendarBooking', calendarBookingGraph);

    console.log('[LangGraphOrchestrator] Initialized graphs:', Array.from(this.graphs.keys()));
  }

  /**
   * Process a user message through the orchestrator
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
  }> {
    try {
      // Detect intent if new session
      let intent = 'CalendarBooking'; // Default for now
      let sessionId = args.sessionId;

      if (!sessionId) {
        // New session, detect intent
        intent = await this.detectIntent(args.message);
        sessionId = uuidv4();

        console.log(`[LangGraphOrchestrator] New session ${sessionId}, intent: ${intent}`);
      } else {
        // Existing session, get intent from database
        const session = await this.stateManager.getSession(sessionId);
        if (session) {
          intent = session.current_intent;
        }
        console.log(`[LangGraphOrchestrator] Existing session ${sessionId}, intent: ${intent}`);
      }

      // Get or create graph
      const graph = this.graphs.get(intent);
      if (!graph) {
        throw new Error(`No graph found for intent: ${intent}`);
      }

      // Get current state from database or create initial state
      let currentState: OrchestratorState;
      const existingCheckpoint = await this.checkpointer.get({
        configurable: { thread_id: sessionId },
      });

      if (existingCheckpoint) {
        // Resume from checkpoint
        currentState = existingCheckpoint.checkpoint.channel_values as OrchestratorState;
        console.log(`[LangGraphOrchestrator] Resuming from node: ${currentState.currentNode}`);

        // Update with new message
        currentState = {
          ...currentState,
          userMessage: args.message,
          messages: [
            ...currentState.messages,
            {
              role: 'user',
              content: args.message,
              timestamp: new Date(),
              nodeContext: currentState.currentNode,
            },
          ],
          turnCount: currentState.turnCount + 1,
          metadata: {
            ...currentState.metadata,
            lastUpdateTime: new Date(),
          },
        };
      } else {
        // Create initial state
        currentState = {
          sessionId,
          chatSessionId: args.chatSessionId,
          userId: args.userId,
          currentIntent: intent,
          currentNode: 'entry',
          status: 'active',
          variables: {},
          messages: [
            {
              role: 'user',
              content: args.message,
              timestamp: new Date(),
              nodeContext: 'entry',
            },
          ],
          agentActions: [],
          userMessage: args.message,
          requiresUserInput: false,
          completed: false,
          conversationEnded: false,
          offTopicCount: 0,
          turnCount: 1,
          authToken: args.authToken,
          metadata: {
            startTime: new Date(),
            lastUpdateTime: new Date(),
            totalAgentCalls: 0,
            totalMcpCalls: 0,
          },
        };
        console.log(`[LangGraphOrchestrator] Created initial state for session ${sessionId}`);
      }

      // Extract data from user message using simple NLP
      currentState = await this.extractDataFromMessage(currentState);

      // Invoke the graph
      const result = await graph.invoke(currentState, {
        configurable: {
          thread_id: sessionId,
        },
      });

      // Save checkpoint
      await this.checkpointer.put(
        { configurable: { thread_id: sessionId } },
        {
          v: 1,
          id: uuidv4(),
          ts: new Date().toISOString(),
          channel_values: result,
          channel_versions: {},
          versions_seen: {},
        },
        {}
      );

      // Automatically disconnect voice session if conversation ended
      if (result.conversationEnded && chatSessionId) {
        try {
          // Try both voice service implementations (OpenAI Realtime and Langraph)
          const { disconnectVoiceSession } = await import('../../voice.service.js');
          const { disconnectVoiceLangraphSession } = await import('../../voice-langraph.service.js');

          const realtimeDisconnected = disconnectVoiceSession(chatSessionId);
          const langraphDisconnected = disconnectVoiceLangraphSession(chatSessionId);

          if (realtimeDisconnected || langraphDisconnected) {
            console.log(`📞 Voice session ${chatSessionId} automatically disconnected by LangGraph orchestrator (${result.endReason})`);
          }
        } catch (error) {
          console.error('Error disconnecting voice session:', error);
          // Don't throw - voice disconnection is not critical
        }
      }

      // Return response
      return {
        sessionId,
        response: result.naturalResponse || 'Processing your request...',
        intent: result.currentIntent,
        currentNode: result.currentNode,
        requiresUserInput: result.requiresUserInput,
        completed: result.completed,
        conversationEnded: result.conversationEnded,
        endReason: result.endReason,
        engagingMessage: result.engagingMessage,
      };
    } catch (error: any) {
      console.error('[LangGraphOrchestrator] Error processing message:', error);
      throw error;
    }
  }

  /**
   * Detect intent from user message
   */
  private async detectIntent(message: string): Promise<string> {
    const lowerMessage = message.toLowerCase();

    // Simple keyword-based intent detection
    const bookingKeywords = ['book', 'schedule', 'appointment', 'service', 'need', 'want', 'landscaping', 'hvac', 'plumbing'];

    for (const keyword of bookingKeywords) {
      if (lowerMessage.includes(keyword)) {
        return 'CalendarBooking';
      }
    }

    // Default intent
    return 'CalendarBooking';
  }

  /**
   * Extract structured data from user message
   * Uses simple regex and keyword matching (could be enhanced with NLP/LLM)
   */
  private async extractDataFromMessage(state: OrchestratorState): Promise<OrchestratorState> {
    const message = state.userMessage?.toLowerCase() || '';

    const updates: Record<string, any> = {};

    // Extract phone number
    const phoneMatch = message.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})/);
    if (phoneMatch) {
      updates.customer_phone = phoneMatch[0].replace(/[-.\s]/g, '');
    }

    // Extract email
    const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) {
      updates.customer_email = emailMatch[0];
    }

    // Extract name (simple heuristic: "I'm X" or "My name is X" or "This is X")
    const nameMatch = message.match(/(?:i'?m|my name is|this is|i am)\s+([a-z]+)/i);
    if (nameMatch) {
      updates.customer_name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
    }

    // Extract service category
    const services = ['hvac', 'plumbing', 'electrical', 'landscaping', 'contracting'];
    for (const service of services) {
      if (message.includes(service)) {
        updates.service_category = service.charAt(0).toUpperCase() + service.slice(1);
        break;
      }
    }

    // Extract date (simple: YYYY-MM-DD format)
    const dateMatch = message.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      updates.desired_date = dateMatch[0];
    }

    // Extract time preference
    if (message.includes('morning') || message.includes('9 am') || message.includes('9am')) {
      updates.selected_time = '9:00 AM';
    } else if (message.includes('afternoon') || message.includes('2 pm') || message.includes('2pm')) {
      updates.selected_time = '2:00 PM';
    }

    // Extract address/city
    const cityMatch = message.match(/(?:in|at|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (cityMatch) {
      updates.customer_city = cityMatch[1];
    }

    // If we have meaningful context in the message, treat it as job description
    if (message.length > 50 && !state.variables.job_description) {
      updates.job_description = state.userMessage;
    }

    // Merge updates into state variables
    if (Object.keys(updates).length > 0) {
      return {
        ...state,
        variables: {
          ...state.variables,
          ...updates,
        },
      };
    }

    return state;
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
    return Array.from(this.graphs.keys()).map(name => ({
      name,
      description: `${name} workflow`,
    }));
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
