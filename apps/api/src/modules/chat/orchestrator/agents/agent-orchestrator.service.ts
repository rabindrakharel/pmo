/**
 * Agent Orchestrator Service
 * Pure agent-based orchestration without LangGraph dependencies
 * Coordinates worker, guider, and navigator agents based on dag.json
 * @module orchestrator/agents/agent-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import { StateManager } from '../state/state-manager.service.js';
import { MCPAdapterService } from '../../mcp-adapter.service.js';
import { getDAGLoader } from './dag-loader.service.js';
import type { DAGConfiguration } from './dag-types.js';
import {
  AgentContextManager,
  getAgentContextManager,
  type AgentContextState
} from './agent-context.service.js';
import { WorkerAgent, createWorkerAgent } from './worker-agent.service.js';
import { NavigatorAgent, createNavigatorAgent } from './navigator-agent.service.js';

/**
 * Agent Orchestrator Service
 * Main service that coordinates multi-agent workflow
 */
export class AgentOrchestratorService {
  private stateManager: StateManager;
  private mcpAdapter: MCPAdapterService;
  private contextManager: AgentContextManager;
  private dagConfig!: DAGConfiguration;

  private workerAgent!: WorkerAgent;
  private navigatorAgent!: NavigatorAgent;

  // In-memory state cache (replace LangGraph checkpointer)
  private stateCache: Map<string, AgentContextState> = new Map();

  constructor() {
    this.stateManager = new StateManager();
    this.mcpAdapter = new MCPAdapterService();
    this.contextManager = getAgentContextManager();

    console.log('[AgentOrchestrator] 🚀 Initializing pure agent-based system');
    this.initializeAgents();
  }

  /**
   * Initialize agents from DAG configuration
   */
  private async initializeAgents(): Promise<void> {
    try {
      const dagLoader = getDAGLoader();
      this.dagConfig = await dagLoader.loadDAGConfig();

      // Pass MCP adapter to Worker so it can execute MCP tools
      this.workerAgent = createWorkerAgent(this.dagConfig, this.mcpAdapter);
      this.navigatorAgent = createNavigatorAgent(this.dagConfig);

      console.log('[AgentOrchestrator] ✅ Agents initialized with MCP integration');
      console.log(`[AgentOrchestrator] Entry node: ${this.dagConfig.graph_config.entry_node}`);
      console.log(`[AgentOrchestrator] Total nodes: ${this.dagConfig.nodes.length}`);
    } catch (error: any) {
      console.error('[AgentOrchestrator] ❌ Failed to initialize agents:', error.message);
      throw error;
    }
  }

  /**
   * Process user message through agent system
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
  }> {
    try {
      // Ensure agents are initialized
      if (!this.dagConfig) {
        await this.initializeAgents();
      }

      let sessionId = args.sessionId;
      let state: AgentContextState;

      if (!sessionId) {
        // New session
        sessionId = uuidv4();
        console.log(`\n[AgentOrchestrator] 🆕 New session ${sessionId}`);

        // Initialize context
        state = this.contextManager.initializeContext(
          sessionId,
          args.chatSessionId,
          args.userId,
          args.authToken
        );

        // Create session in database
        await this.stateManager.createSession({
          session_id: sessionId,
          chat_session_id: args.chatSessionId,
          user_id: args.userId,
          current_intent: 'CalendarBooking',
          current_node: 'GREET_CUSTOMER',
          auth_metadata: { authToken: args.authToken },
        });
      } else {
        // Existing session - load from cache or database
        console.log(`\n[AgentOrchestrator] 📂 Resuming session ${sessionId}`);
        state = await this.loadState(sessionId);
      }

      // Add user message to state
      if (args.message) {
        state = this.contextManager.addUserMessage(state, args.message);
      }

      // Execute conversation loop
      state = await this.executeConversationLoop(state, args.message);

      // Save state
      await this.saveState(state);

      // Update session in database
      await this.stateManager.updateSession(sessionId, {
        current_node: state.currentNode,
        status: state.completed ? 'completed' : 'active',
      });

      // Auto-disconnect voice if needed
      if (state.conversationEnded && args.chatSessionId) {
        await this.autoDisconnectVoice(args.chatSessionId, state.endReason);
      }

      // Get last assistant message
      const lastAssistantMessage = this.contextManager.getLastAssistantMessage(state);

      return {
        sessionId,
        response: lastAssistantMessage || '',
        intent: 'CalendarBooking',
        currentNode: state.currentNode,
        requiresUserInput: !state.conversationEnded,
        completed: state.completed,
        conversationEnded: state.conversationEnded,
        endReason: state.endReason,
      };
    } catch (error: any) {
      console.error('[AgentOrchestrator] ❌ Error processing message:', error);
      throw error;
    }
  }

  /**
   * Main conversation execution loop
   */
  private async executeConversationLoop(
    initialState: AgentContextState,
    userMessage?: string
  ): Promise<AgentContextState> {
    let state = initialState;
    let iterations = 0;
    const maxIterations = 20; // Prevent infinite loops

    while (iterations < maxIterations) {
      iterations++;
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🔄 ITERATION ${iterations} - Current Node: ${state.currentNode}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Check if conversation has ended
      if (state.conversationEnded) {
        console.log(`[AgentOrchestrator] ✅ Conversation ended: ${state.endReason}`);
        break;
      }

      // STEP 1: Ask Navigator - should we execute current node or skip?
      // Navigator uses LLM to decide based on flags and context (no rules)
      const preCheckDecision = await this.navigatorAgent.decideNextNode(state);

      // If Navigator says skip to next node, don't execute current node
      if (preCheckDecision.skipCurrent || preCheckDecision.nextNode !== state.currentNode) {
        console.log(`[AgentOrchestrator] ⏭️  Navigator decided to skip ${state.currentNode}`);
        console.log(`[AgentOrchestrator] Routing to: ${preCheckDecision.nextNode}`);

        state = this.contextManager.updateContext(state, {
          next_node_to_go_to: preCheckDecision.nextNode,
          next_course_of_action: preCheckDecision.nextCourseOfAction,
        });

        if (preCheckDecision.nextNode === 'END') {
          console.log(`[AgentOrchestrator] 🛑 Waiting for user input`);
          break;
        }

        state = this.contextManager.updateCurrentNode(state, preCheckDecision.nextNode);
        continue;
      }

      // STEP 2: Worker Agent executes node
      const workerResult = await this.workerAgent.executeNode(
        state.currentNode,
        state,
        iterations === 1 ? userMessage : undefined
      );

      // Update state with worker results
      state = this.contextManager.addAssistantMessage(state, workerResult.response);
      state = this.contextManager.updateContext(state, workerResult.contextUpdates);

      // STEP 3: Navigator Agent decides next node after execution
      const navigatorDecision = await this.navigatorAgent.decideNextNode(state);

      // Apply flag resets if conversation is off-track
      if (!navigatorDecision.validationStatus.onTrack) {
        console.log(`[AgentOrchestrator] ⚠️ Conversation off-track: ${navigatorDecision.validationStatus.reason}`);

        if (navigatorDecision.validationStatus.flagResets) {
          state = this.contextManager.updateContext(state, {
            flags: {
              ...state.context.flags,
              ...navigatorDecision.validationStatus.flagResets,
            },
          });
        }
      }

      // Update context with navigator decisions
      state = this.contextManager.updateContext(state, {
        next_node_to_go_to: navigatorDecision.nextNode,
        next_course_of_action: navigatorDecision.nextCourseOfAction,
      });

      // Check if we should end conversation
      if (navigatorDecision.nextNode === 'END') {
        console.log(`[AgentOrchestrator] 🛑 Waiting for user input`);
        break;
      }

      if (navigatorDecision.nextNode === 'Goodbye_And_Hangup') {
        state = this.contextManager.endConversation(state, 'Completed');
        break;
      }

      // Move to next node
      state = this.contextManager.updateCurrentNode(state, navigatorDecision.nextNode);

      // Break if waiting for user input (single turn)
      if (iterations === 1 && navigatorDecision.nextNode !== state.currentNode) {
        console.log(`[AgentOrchestrator] 💬 Single turn complete, waiting for next user message`);
        break;
      }
    }

    if (iterations >= maxIterations) {
      console.warn(`[AgentOrchestrator] ⚠️ Max iterations reached (${maxIterations})`);
    }

    return state;
  }

  /**
   * Load state from cache or database
   */
  private async loadState(sessionId: string): Promise<AgentContextState> {
    // Try cache first
    if (this.stateCache.has(sessionId)) {
      console.log(`[AgentOrchestrator] 📦 Loaded state from cache`);
      return this.stateCache.get(sessionId)!;
    }

    // Load from database
    const dbState = await this.stateManager.getAllState(sessionId);
    if (dbState && dbState.context) {
      console.log(`[AgentOrchestrator] 💾 Loaded state from database`);
      const state = this.contextManager.fromPlainObject(dbState);
      this.stateCache.set(sessionId, state);
      return state;
    }

    // No state found, create new
    console.warn(`[AgentOrchestrator] ⚠️ No state found for session ${sessionId}, creating new`);
    return this.contextManager.initializeContext(sessionId);
  }

  /**
   * Save state to cache and database
   */
  private async saveState(state: AgentContextState): Promise<void> {
    // Save to cache
    this.stateCache.set(state.sessionId, state);

    // Save to database
    const plainState = this.contextManager.toPlainObject(state);
    await this.stateManager.setState(
      state.sessionId,
      'context',
      plainState.context,
      { source: 'agent-orchestrator', validated: true }
    );
    await this.stateManager.setState(
      state.sessionId,
      'messages',
      plainState.messages,
      { source: 'agent-orchestrator', validated: true }
    );
    await this.stateManager.setState(
      state.sessionId,
      'current_node',
      plainState.currentNode,
      { source: 'agent-orchestrator', validated: true }
    );

    console.log(`[AgentOrchestrator] 💾 State saved for session ${state.sessionId}`);
  }

  /**
   * Auto-disconnect voice session
   */
  private async autoDisconnectVoice(chatSessionId: string, endReason?: string): Promise<void> {
    try {
      const { disconnectVoiceLangraphSession } = await import('../../voice-langraph.service.js');
      const disconnected = disconnectVoiceLangraphSession(chatSessionId);

      if (disconnected) {
        console.log(`📞 Voice session ${chatSessionId} auto-disconnected (${endReason})`);
      }
    } catch (error) {
      console.error('Error disconnecting voice session:', error);
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

    const state = await this.loadState(sessionId);
    const logs = await this.stateManager.getAgentLogs(sessionId);

    return {
      session,
      state: this.contextManager.toPlainObject(state),
      logs: logs.slice(0, 10),
    };
  }

  /**
   * List available intents
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
let instance: AgentOrchestratorService | null = null;

export function getAgentOrchestratorService(): AgentOrchestratorService {
  if (!instance) {
    instance = new AgentOrchestratorService();
  }
  return instance;
}
