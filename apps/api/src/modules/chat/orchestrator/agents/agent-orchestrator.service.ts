/**
 * Agent Orchestrator Service
 * Pure agent-based orchestration without LangGraph dependencies
 * Coordinates worker, guider, and navigator agents based on agent_config.json
 * @module orchestrator/agents/agent-orchestrator
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { StateManager } from '../state/state-manager.service.js';
import { MCPAdapterService } from '../../mcp-adapter.service.js';
import { getAgentConfigLoader } from './dag-loader.service.js';
import type { AgentConfigV3 } from '../config/agent-config.schema.js';
import {
  AgentContextManager,
  getAgentContextManager,
  type AgentContextState
} from './agent-context.service.js';
import { WorkerReplyAgent, createWorkerReplyAgent } from './worker-reply-agent.service.js';
import { WorkerMCPAgent, createWorkerMCPAgent } from './worker-mcp-agent.service.js';
import { GoalTransitionEngine } from '../engines/goal-transition.engine.js';
import { DataExtractionAgent, createDataExtractionAgent } from './data-extraction-agent.service.js';
import { getLLMLogger } from '../services/llm-logger.service.js';
import { createAgentLogger, type AgentLogger } from '../services/agent-logger.service.js';
import { getSessionMemoryDataService } from '../services/session-memory-data.service.js';
import type { SessionMemoryData } from '../services/session-memory-data.service.js';

/**
 * Agent Orchestrator Service
 * Main service that coordinates multi-agent workflow
 */
export class AgentOrchestratorService {
  private stateManager: StateManager;
  private mcpAdapter: MCPAdapterService;
  private contextManager: AgentContextManager;
  private config!: AgentConfigV3;
  private logger = getLLMLogger();

  private workerReplyAgent!: WorkerReplyAgent;
  private workerMCPAgent!: WorkerMCPAgent;
  private transitionEngine!: GoalTransitionEngine;
  private dataExtractionAgent!: DataExtractionAgent;

  // In-memory state cache (replace LangGraph checkpointer)
  private stateCache: Map<string, AgentContextState> = new Map();

  // Context file directory
  private contextDir: string = './logs/contexts';

  // Logging control - set via env var VERBOSE_AGENT_LOGS=true for detailed logs
  private readonly VERBOSE_LOGS = process.env.VERBOSE_AGENT_LOGS === 'true';

  constructor() {
    this.stateManager = new StateManager();
    this.mcpAdapter = new MCPAdapterService();
    this.contextManager = getAgentContextManager();

    console.log('[AgentOrchestrator] 🚀 Initializing pure agent-based system with LowDB');
    this.initializeSessionMemoryData();
    this.initializeContextDir();
    this.initializeAgents();
  }

  /**
   * Initialize LowDB for session memory data storage
   */
  private async initializeSessionMemoryData(): Promise<void> {
    try {
      const sessionMemoryDataService = getSessionMemoryDataService();
      await sessionMemoryDataService.initialize();
      console.log(`[AgentOrchestrator] 🗄️  LowDB initialized: ${sessionMemoryDataService.getDbPath()}`);
    } catch (error: any) {
      console.error(`[AgentOrchestrator] ❌ Failed to initialize LowDB: ${error.message}`);
    }
  }

  /**
   * Initialize context directory
   */
  private async initializeContextDir(): Promise<void> {
    try {
      await fs.mkdir(this.contextDir, { recursive: true });
      console.log(`[AgentOrchestrator] 📁 Context directory: ${this.contextDir}`);
    } catch (error: any) {
      console.error(`[AgentOrchestrator] ❌ Failed to create context directory: ${error.message}`);
    }
  }

  /**
   * Get context file path for session
   */
  private getContextFilePath(sessionId: string): string {
    return path.join(this.contextDir, `session_${sessionId}_memory_data.json`);
  }

  /**
   * Write session memory data to LowDB - REPLACES FILE WRITE
   */
  private async writeContextFile(state: AgentContextState, action: string = 'update'): Promise<void> {
    try {
      const sessionMemoryDataService = getSessionMemoryDataService();

      const sessionData: SessionMemoryData = {
        sessionId: state.sessionId,
        chatSessionId: state.chatSessionId,
        userId: state.userId,
        currentNode: state.currentNode,
        previousNode: state.previousNode,
        completed: state.completed,
        conversationEnded: state.conversationEnded,
        endReason: state.endReason,
        context: state.context,
        // ✅ REMOVED: messages array no longer saved (redundant with summary_of_conversation_on_each_step_until_now)
        lastUpdated: new Date().toISOString(),
        action,
      };

      await sessionMemoryDataService.saveSession(sessionData);

      const truncatedId = state.sessionId.substring(0, 8);
      const shortAction = action.length > 50 ? action.substring(0, 47) + '...' : action;
      console.log(`[AgentOrchestrator] 💾 LowDB: session_${truncatedId}... (${shortAction})`);

      // ========================================================================
      // DUMP COMPLETE SESSION MEMORY DATA TO LOGS (User Requested)
      // ========================================================================
      console.log(`\n┌════════════════════════════════════════════════════════════════════┐`);
      console.log(`│ 📄 COMPLETE SESSION MEMORY DATA (LowDB) - ${shortAction.padEnd(28)} │`);
      console.log(`│ Session: ${truncatedId}${' '.repeat(59 - truncatedId.length)}│`);
      console.log(`└════════════════════════════════════════════════════════════════════┘`);
      console.log(JSON.stringify(sessionData, null, 2));
      console.log(`┌════════════════════════════════════════════════════════════════════┐`);
      console.log(`│ END OF CONTEXT DATA${' '.repeat(49)}│`);
      console.log(`└════════════════════════════════════════════════════════════════════┘\n`);
    } catch (error: any) {
      console.error(`[AgentOrchestrator] ❌ Failed to save context to LowDB: ${error.message}`);
    }
  }

  /**
   * Read session memory data from LowDB - REPLACES FILE READ
   */
  private async readContextFile(sessionId: string): Promise<any | null> {
    try {
      const sessionMemoryDataService = getSessionMemoryDataService();
      const session = await sessionMemoryDataService.getSession(sessionId);

      if (!session) {
        console.log(`[AgentOrchestrator] ℹ️  Session ${sessionId.substring(0, 8)}... not found in LowDB`);
        return null;
      }

      console.log(`[AgentOrchestrator] 📖 Loaded session ${sessionId.substring(0, 8)}... from LowDB`);
      return session;
    } catch (error: any) {
      console.error(`[AgentOrchestrator] ❌ Failed to read context from LowDB: ${error.message}`);
      return null;
    }
  }

  /**
   * Initialize agents from agent configuration
   */
  private async initializeAgents(): Promise<void> {
    try {
      const configLoader = getAgentConfigLoader();
      this.config = await configLoader.loadAgentConfig();

      // Pass agent config to context manager for deterministic initialization
      this.contextManager.setDAGConfig(this.config as any); // TODO: Update context manager to use AgentConfigV3

      // Initialize worker agents and transition engine:
      // 1. WorkerReplyAgent - generates customer-facing responses (uses agent profile)
      // 2. WorkerMCPAgent - executes MCP tools and updates context
      // 3. DataExtractionAgent - extracts context from conversation (called AFTER worker agents)
      // 4. GoalTransitionEngine - evaluates goal transitions using semantic routing
      this.workerReplyAgent = createWorkerReplyAgent(this.config, 'conversational_agent');
      this.workerMCPAgent = createWorkerMCPAgent(this.config as any, this.mcpAdapter); // TODO: Update worker-mcp-agent
      this.transitionEngine = new GoalTransitionEngine(this.config);
      this.dataExtractionAgent = createDataExtractionAgent();

      console.log('[AgentOrchestrator] ✅ Agents initialized (Goal-Oriented Architecture v3.0)');
      console.log('[AgentOrchestrator]    - WorkerReplyAgent: Customer-facing responses');
      console.log('[AgentOrchestrator]    - WorkerMCPAgent: MCP tool execution');
      console.log('[AgentOrchestrator]    - DataExtractionAgent: Context extraction (post-processing)');
      console.log('[AgentOrchestrator]    - GoalTransitionEngine: Semantic goal routing');
      console.log(`[AgentOrchestrator] Total goals: ${this.config.goals.length}`);
      console.log(`[AgentOrchestrator] Agent profiles: ${Object.keys(this.config.agent_profiles).join(', ')}`);
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
      // Ensure SessionMemoryDataService is initialized before processing
      await this.initializeSessionMemoryData();

      // Ensure agents are initialized
      if (!this.config) {
        await this.initializeAgents();
      }

      let sessionId = args.sessionId;
      let state: AgentContextState;

      if (!sessionId) {
        // New session
        sessionId = uuidv4();
        console.log(`\n[AgentOrchestrator] 🆕 New session ${sessionId}`);

        // Log session start
        await this.logger.logSessionStart(sessionId, args.chatSessionId, args.userId);

        // Initialize context
        state = this.contextManager.initializeContext(
          sessionId,
          args.chatSessionId,
          args.userId,
          args.authToken
        );

        // Write initial context to JSON file
        await this.writeContextFile(state, 'initialize');

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

      // ✅ REMOVED: No longer add to messages array - conversation tracked in summary_of_conversation_on_each_step_until_now
      // User message will be added to summary after worker execution (lines 543-566)

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
        // Finalize context file
        await this.writeContextFile(state, 'finalize');

        // Log session end
        await this.logger.logSessionEnd({
          sessionId,
          endReason: state.endReason || 'unknown',
          totalIterations: state.context.node_traversed?.length || 0,
          totalMessages: (state.context.summary_of_conversation_on_each_step_until_now || []).length,
        });
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
    let loopBackIntention: string | undefined = undefined; // Track loop-back intention for current iteration

    // Create session-scoped concise logger
    const logger = createAgentLogger(state.sessionId);

    while (iterations < maxIterations) {
      iterations++;

      // Concise iteration log
      logger.iteration(iterations, state.currentNode, iterations === 1 ? userMessage : undefined);

      // Log iteration start (detailed file logging)
      await this.logger.logIterationStart(
        iterations,
        state.sessionId,
        state.currentNode,
        iterations === 1 ? userMessage : undefined
      );

      // Verbose context logging (only if enabled)
      if (this.VERBOSE_LOGS) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 [COMPLETE CONTEXT STATE - Iteration ${iterations}]`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`\n🎯 EXECUTION STATE:`);
        console.log(`   Current Node: ${state.currentNode}`);
        console.log(`   Previous Node: ${state.previousNode || '(none)'}`);
        console.log(`   Loop Back Intention: ${state.loopBackIntention || '(none)'}`);
        console.log(`   Conversation Ended: ${state.conversationEnded ? 'YES' : 'NO'}`);
        if (state.endReason) console.log(`   End Reason: ${state.endReason}`);
        console.log(`\n🗺️  NODE TRAVERSAL HISTORY (${state.context.node_traversed?.length || 0} nodes):`);
        console.log(`   ${JSON.stringify(state.context.node_traversed || [], null, 2)}`);
        console.log(`\n👤 CUSTOMER IDENTIFICATION:`);
        console.log(`   ✓ customer_name: ${state.context.data_extraction_fields?.customer_name || '(not set)'}`);
        console.log(`   ✓ customer_phone_number: ${state.context.data_extraction_fields?.customer_phone_number || '(not set)'}`);
        console.log(`   ✓ customer_id: ${state.context.data_extraction_fields?.customer_id || '(not set)'}`);
        console.log(`\n🎯 CUSTOMER NEED/PROBLEM:`);
        console.log(`   ✓ customers_main_ask: ${state.context.data_extraction_fields?.customers_main_ask || '(not set)'}`);
        console.log(`\n🔧 SERVICE MATCHING:`);
        console.log(`   ✓ matching_service_catalog_to_solve_customers_issue: ${state.context.data_extraction_fields?.matching_service_catalog_to_solve_customers_issue || '(not set)'}`);
        console.log(`\n📅 TASK/BOOKING:`);
        console.log(`   ✓ task_id: ${state.context.data_extraction_fields?.task_id || '(not set)'}`);
        console.log(`   ✓ appointment_details: ${state.context.data_extraction_fields?.appointment_details || '(not set)'}`);
        console.log(`\n🧭 NAVIGATION/PLANNING:`);
        console.log(`   ✓ next_node_to_go_to: ${state.context.next_node_to_go_to || '(not set)'}`);
        console.log(`   ✓ next_course_of_action: ${state.context.next_course_of_action || '(not set)'}`);
        console.log(`\n📋 RAW CONTEXT OBJECT (JSON):`);
        console.log(JSON.stringify(state.context, null, 2));
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      }

      // Log full context state to llm.log
      await this.logger.logContextState(state, 'CONTEXT BEFORE EXECUTION');

      // Check if conversation has ended
      if (state.conversationEnded) {
        logger.end(state.endReason || 'unknown');
        break;
      }

      // Goal-based architecture: No explicit loop-back intentions
      // Goals are more flexible - agents can revisit goals based on context
      loopBackIntention = undefined;
      state.loopBackIntention = undefined;

      // STEP 1: Choose correct worker agent based on current goal
      // TODO: In future, use goal.allowed_agents to determine which agent to use
      // For now, default to worker_reply_agent unless context indicates MCP operation needed
      const needsMCP = state.context.next_course_of_action?.toLowerCase().includes('mcp') ||
                       state.context.next_course_of_action?.toLowerCase().includes('book') ||
                       state.context.next_course_of_action?.toLowerCase().includes('create task');
      const agentProfileType = needsMCP ? 'worker_mcp_agent' : 'worker_reply_agent';

      let response: string = '';
      let contextUpdates: any = {};

      if (agentProfileType === 'worker_mcp_agent') {
        // Use WorkerMCPAgent for MCP operations
        const mcpResult = await this.workerMCPAgent.executeNode(state.currentNode, state);
        logger.agent('worker_mcp', state.currentNode, mcpResult.statusMessage);

        if (this.VERBOSE_LOGS) {
          console.log(`\n📝 [WORKER MCP RESULT]`);
          console.log(`   Status: "${mcpResult.statusMessage}"`);
          console.log(`   Context Updates: ${JSON.stringify(mcpResult.contextUpdates, null, 2)}`);
          console.log(`   MCP Executed: ${mcpResult.mcpExecuted}`);
        }

        response = mcpResult.statusMessage || '';
        contextUpdates = mcpResult.contextUpdates;

        // Log agent execution
        await this.logger.logAgentExecution({
          agentType: 'worker_mcp',
          nodeName: state.currentNode,
          result: mcpResult,
          sessionId: state.sessionId,
        });

      } else if (agentProfileType === 'worker_reply_agent') {
        // Use WorkerReplyAgent for customer-facing responses
        const replyResult = await this.workerReplyAgent.executeNode(
          state.currentNode,
          state,
          iterations === 1 ? userMessage : undefined
        );
        logger.agent('worker_reply', state.currentNode, replyResult.response);

        response = replyResult.response;

        // Log agent execution
        await this.logger.logAgentExecution({
          agentType: 'worker_reply',
          nodeName: state.currentNode,
          result: replyResult,
          sessionId: state.sessionId,
        });

      } else if (agentProfileType === 'internal') {
        // Internal nodes (wait_for_customers_reply) - no agent execution needed
        console.log(`[AgentOrchestrator] ⏸️  Internal node - skipping agent execution`);

      } else if (agentProfileType === 'summarizer_agent') {
        // Summarizer agent - could be implemented later
        console.log(`[AgentOrchestrator] 📋 Summarizer node - skipping for now`);

      } else {
        console.warn(`[AgentOrchestrator] ⚠️  Unknown agent_profile_type: ${agentProfileType}`);
      }

      // Log full AI response for log parsing
      if (response) {
        console.log(`[AgentOrchestrator] 🤖 AI_RESPONSE: ${response}`);
      }

      // ✅ REMOVED: No longer add to messages array - conversation tracked in summary_of_conversation_on_each_step_until_now
      // Assistant response will be added to summary after worker execution (lines 543-566)

      // Update state with worker context updates
      if (Object.keys(contextUpdates).length > 0) {
        state = this.contextManager.updateContext(state, contextUpdates);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP: Call DataExtractionAgent AFTER worker agents complete
      // This agent analyzes conversation and extracts missing context fields
      // ✅ FIX: Pass current exchange to avoid stale context issues
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (agentProfileType === 'worker_reply_agent' || agentProfileType === 'worker_mcp_agent') {
        // Build current exchange from latest user message and agent response
        const currentExchange = (iterations === 1 && userMessage && response) ? {
          customer: userMessage,
          agent: response
        } : undefined;

        const extractionResult = await this.dataExtractionAgent.extractAndUpdateContext(state, currentExchange);

        if (extractionResult.fieldsUpdated && extractionResult.fieldsUpdated.length > 0) {
          logger.extraction(extractionResult.fieldsUpdated);

          if (this.VERBOSE_LOGS) {
            console.log(`\n📊 [DATA EXTRACTION RESULT]`);
            console.log(`   Extraction Reason: ${extractionResult.extractionReason}`);
            console.log(`   Fields Updated: ${extractionResult.fieldsUpdated.join(', ')}`);
            console.log(`   Context Updates: ${JSON.stringify(extractionResult.contextUpdates, null, 2)}`);
          }

          // Merge extraction results into context
          state = this.contextManager.updateContext(state, extractionResult.contextUpdates || {});

          // CRITICAL: Write context to persistent JSON file immediately after extraction
          await this.writeContextFile(state, `extraction:${extractionResult.fieldsUpdated.join(',')}`);

          // Log extraction to llm.log
          await this.logger.logAgentExecution({
            agentType: 'data_extraction',
            nodeName: state.currentNode,
            result: extractionResult,
            sessionId: state.sessionId,
          });
        } else {
          console.log(`   No new fields extracted`);
        }
      }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      // Log conversation turn to llm.log (only on first iteration)
      if (iterations === 1 && userMessage && response) {
        await this.logger.logConversationTurn({
          userMessage,
          aiResponse: response,
          sessionId: state.sessionId,
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // INDEXED CONVERSATION SUMMARY
        // ✅ FIX: Only append NEW exchange (updateContext will append to array)
        // Don't spread currentSummary as updateContext already handles appending
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const currentSummary = state.context.summary_of_conversation_on_each_step_until_now || [];
        const nextIndex = currentSummary.length; // Next index is current length (0, 1, 2, ...)

        // Check if this exact exchange already exists (prevent duplicates)
        const isDuplicate = currentSummary.some((entry: any) =>
          entry.customer === userMessage && entry.agent === response
        );

        if (!isDuplicate) {
          // ✅ FIX: Pass only the NEW item (not spreading existing array)
          // updateContext will append it to existing summary via non-destructive merge
          state = this.contextManager.updateContext(state, {
            summary_of_conversation_on_each_step_until_now: [
              {
                index: nextIndex,
                customer: userMessage,
                agent: response
              }
            ]
          });
          console.log(`[AgentOrchestrator] 💬 Added conversation exchange #${nextIndex} to summary`);
        } else {
          console.log(`[AgentOrchestrator] ⚠️ Skipping duplicate conversation entry`);
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // TRACK NODE TRAVERSAL
      // ✅ FIX: NO longer append here - node traversal happens ONLY in updateCurrentNode()
      // This prevents duplicate entries (was appending both here AND in updateCurrentNode)
      // We just log the current path length for visibility
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const totalNodes = (state.context.node_traversed || []).length;
      if (iterations === 1) {
        console.log(`[AgentOrchestrator] 🗺️  Executing ${state.currentNode} (path length: ${totalNodes})`);
      } else {
        console.log(`[AgentOrchestrator] ℹ️  Still in ${state.currentNode} (path length: ${totalNodes})`);
      }

      // Write context file after worker execution
      await this.writeContextFile(state, `node:${state.currentNode}`);

      // Concise snapshot after worker execution
      logger.snapshot({
        node: state.currentNode,
        customer_name: state.context.data_extraction_fields?.customer_name,
        customer_phone: state.context.data_extraction_fields?.customer_phone_number,
        main_ask: state.context.data_extraction_fields?.customers_main_ask,
        task_id: state.context.data_extraction_fields?.task_id,
        traversed: state.context.node_traversed?.length
      });

      if (this.VERBOSE_LOGS) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 [CONTEXT AFTER WORKER EXECUTION]`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`\n👤 CUSTOMER DATA:`);
        console.log(`   ✓ customer_name: ${state.context.data_extraction_fields?.customer_name || '(not set)'}`);
        console.log(`   ✓ customer_phone_number: ${state.context.data_extraction_fields?.customer_phone_number || '(not set)'}`);
        console.log(`   ✓ customer_id: ${state.context.data_extraction_fields?.customer_id || '(not set)'}`);
        console.log(`\n🎯 PROBLEM/SERVICE:`);
        console.log(`   ✓ customers_main_ask: ${state.context.data_extraction_fields?.customers_main_ask || '(not set)'}`);
        console.log(`   ✓ service_catalog: ${state.context.data_extraction_fields?.matching_service_catalog_to_solve_customers_issue || '(not set)'}`);
        console.log(`\n📅 TASK/BOOKING:`);
        console.log(`   ✓ task_id: ${state.context.data_extraction_fields?.task_id || '(not set)'}`);
        console.log(`   ✓ appointment_details: ${state.context.data_extraction_fields?.appointment_details || '(not set)'}`);
        console.log(`\n🗺️  NAVIGATION HISTORY (${state.context.node_traversed?.length || 0} nodes):`);
        console.log(`   ${JSON.stringify(state.context.node_traversed || [], null, 2)}`);
        const summaryCount = state.context.summary_of_conversation_on_each_step_until_now?.length || 0;
        console.log(`\n💬 CONVERSATION (${summaryCount} indexed exchanges)`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      }

      // STEP 2: GoalTransitionEngine evaluates if we should transition to next goal
      // Build conversation history for semantic evaluation
      const conversationHistory = (state.context.summary_of_conversation_on_each_step_until_now || []).map(
        (entry: any) => ({ customer: entry.customer, agent: entry.agent })
      );

      // Use migration utility to build v3 context (temporary until full migration)
      const { migrateContextV2toV3 } = await import('../migrations/context-migration-v2-to-v3.js');
      const contextV3 = migrateContextV2toV3(state.context, state.sessionId, state.chatSessionId, state.userId);

      // Evaluate transition
      const transitionResult = await this.transitionEngine.evaluateTransition(
        contextV3.conversation.current_goal,
        contextV3,
        conversationHistory
      );

      logger.navigate(
        contextV3.conversation.current_goal,
        transitionResult.nextGoal || contextV3.conversation.current_goal,
        transitionResult.reason
      );

      if (this.VERBOSE_LOGS) {
        console.log(`\n🧭 [GOAL TRANSITION EVALUATION]`);
        console.log(`   Current Goal: ${contextV3.conversation.current_goal}`);
        console.log(`   Should Transition: ${transitionResult.shouldTransition ? '✅ YES' : '❌ NO'}`);
        console.log(`   Reason: ${transitionResult.reason}`);
        if (transitionResult.shouldTransition && transitionResult.nextGoal) {
          console.log(`   Next Goal: ${transitionResult.nextGoal}`);
        }
      }

      // Log transition decision to llm.log
      await this.logger.logNavigatorDecision({
        currentNode: contextV3.conversation.current_goal,
        decision: transitionResult.shouldTransition ? 'Transition' : 'Stay in Goal',
        nextNode: transitionResult.nextGoal || contextV3.conversation.current_goal,
        reason: transitionResult.reason,
        sessionId: state.sessionId,
      });

      // Update context with next goal (use old currentNode field for now)
      const nextNodeOrGoal = transitionResult.shouldTransition && transitionResult.nextGoal
        ? transitionResult.nextGoal
        : contextV3.conversation.current_goal;

      state = this.contextManager.updateContext(state, {
        next_node_to_go_to: nextNodeOrGoal,
        next_course_of_action: transitionResult.reason,
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // LOOP DETECTION & RETRY GUIDANCE
      // Track repeated visits to same goal and provide guidance to try differently
      // Data is NEVER erased - only approach varies
      // Uses node_traversed array to count visits (enables loop detection)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const allTraversedNodes = state.context.node_traversed || [];
      const recentNodes = allTraversedNodes.slice(-10); // Last 10 goals

      // Count how many times the NEXT goal appears in recent history
      const nextNodeVisitCount = recentNodes.filter(n => n === nextNodeOrGoal).length;

      // Count total visits to next goal across entire conversation
      const totalNextNodeVisits = allTraversedNodes.filter(n => n === nextNodeOrGoal).length;
      const attemptNumber = totalNextNodeVisits + 1; // Next visit will be attempt N+1

      if (nextNodeVisitCount >= 2) {
        console.log(`\n🔄 [LOOP DETECTED] ${nextNodeOrGoal} visited ${nextNodeVisitCount} times in last 10 goals (attempt #${attemptNumber} total)`);
        console.log(`   Recent path (last 10): ${JSON.stringify(recentNodes)}`);
        console.log(`   ℹ️  Providing retry guidance to try different approach...`);
        console.log(`   ⚠️  IMPORTANT: Data collected so far is PRESERVED`);

        // Generate retry guidance based on goal type and attempt number
        let retryGuidance = '';

        if (nextNodeOrGoal === 'GATHER_REQUIREMENTS') {
          const dataFields = state.context.data_extraction_fields || {};

          if (attemptNumber === 3) {
            retryGuidance = `This is attempt #${attemptNumber} to gather customer data. Try a different approach:\n`;
            retryGuidance += `- Currently have: name="${dataFields.customer_name || '(missing)'}", phone="${dataFields.customer_phone_number || '(missing)'}"\n`;
            retryGuidance += `- Try asking: "To help you better, could you share your contact number?"\n`;
            retryGuidance += `- Be more direct and specific about what's needed`;
          } else if (attemptNumber === 4) {
            retryGuidance = `This is attempt #${attemptNumber}. Try offering value:\n`;
            retryGuidance += `- Example: "So I can send you updates about the service, what's a good number to reach you?"\n`;
            retryGuidance += `- Explain WHY you need the information`;
          } else if (attemptNumber >= 5) {
            retryGuidance = `This is attempt #${attemptNumber}. Offer alternative:\n`;
            retryGuidance += `- Example: "I can proceed with partial information. Would you like to continue or provide a contact number?"\n`;
            retryGuidance += `- Give customer option to skip if they prefer`;
          } else {
            retryGuidance = `Try rephrasing the question differently. Current data: ${JSON.stringify(dataFields)}`;
          }

        } else if (nextNodeOrGoal === 'UNDERSTAND_REQUEST') {
          if (attemptNumber === 3) {
            retryGuidance = `Customer response unclear. Try:\n`;
            retryGuidance += `- Ask more specific questions about their issue\n`;
            retryGuidance += `- Example: "What specific problem are you experiencing with your [roof/plumbing/etc]?"`;
          } else if (attemptNumber >= 4) {
            retryGuidance = `Provide examples to help customer:\n`;
            retryGuidance += `- Example: "For example, is it a leak, damage, installation, or something else?"\n`;
            retryGuidance += `- Give concrete options to choose from`;
          }

        } else {
          retryGuidance = `Attempt #${attemptNumber}. Try varying your approach to achieve goal: ${nextNodeOrGoal}`;
        }

        // Update context with retry guidance (NEVER reset data)
        state = this.contextManager.updateContext(state, {
          next_course_of_action: retryGuidance
        });

        // Log loop detection event
        await this.logger.logAgentExecution({
          agentType: 'loop_detection',
          nodeName: state.currentNode,
          result: {
            loopDetected: true,
            attemptNumber,
            recentVisits: nextNodeVisitCount,
            totalVisits: totalNextNodeVisits,
            nextNode: nextNodeOrGoal,
            retryGuidance,
            dataPreserved: true,
            recentPath: recentNodes,
            currentData: state.context.data_extraction_fields
          },
          sessionId: state.sessionId,
        });

        console.log(`   📝 Retry guidance: ${retryGuidance.substring(0, 150)}...`);
        const collectedFields = Object.keys(state.context.data_extraction_fields || {}).filter(k => state.context.data_extraction_fields[k]);
        console.log(`   ✅ Data preserved (${collectedFields.length} fields): ${collectedFields.join(', ') || '(none yet)'}`);
      }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 [CONTEXT AFTER NAVIGATOR DECISION]`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`\n🧭 NAVIGATION UPDATES:`);
      console.log(`   ✓ next_node_to_go_to: ${state.context.next_node_to_go_to}`);
      console.log(`   ✓ next_course_of_action: ${state.context.next_course_of_action}`);
      console.log(`\n🗺️  PATH HISTORY (${state.context.node_traversed?.length || 0} nodes):`);
      console.log(`   ${JSON.stringify(state.context.node_traversed || [], null, 2)}`);
      console.log(`\n💡 KEY CONTEXT FIELDS:`);
      console.log(`   ✓ customers_main_ask: ${state.context.data_extraction_fields?.customers_main_ask || '(not set)'}`);
      console.log(`   ✓ customer_phone_number: ${state.context.data_extraction_fields?.customer_phone_number || '(not set)'}`);
      console.log(`   ✓ service_catalog: ${state.context.data_extraction_fields?.matching_service_catalog_to_solve_customers_issue || '(not set)'}`);
      console.log(`   ✓ task_id: ${state.context.data_extraction_fields?.task_id || '(not set)'}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Log Transition decision
      console.log(`[AgentOrchestrator] ➡️  Goal transition: ${state.currentNode} → ${nextNodeOrGoal}`);

      // STEP 3: Transition to next goal if needed

      // Check if we should end conversation
      if (nextNodeOrGoal === 'END') {
        // Special case: If we're coming from Execute_Call_Hangup, end the entire conversation
        if (state.currentNode === 'Execute_Call_Hangup') {
          console.log(`\n📞 [CALL HANGUP COMPLETE]`);
          console.log(`   MCP hangup executed successfully`);
          console.log(`   Ending conversation with status: Call Terminated`);
          state = this.contextManager.endConversation(state, 'Call Terminated');
          console.log(`   conversationEnded: ${state.conversationEnded}`);
          console.log(`   endReason: ${state.endReason}`);

          // Log iteration end
          await this.logger.logIterationEnd({
            iteration: iterations,
            nextNode: 'END',
            conversationEnded: true,
            endReason: state.endReason,
            sessionId: state.sessionId,
          });
          break;
        }

        // Normal END: wait for user input
        console.log(`\n🛑 [END OF TURN]`);
        console.log(`   Reason: Waiting for user input`);
        console.log(`   Current node remains: ${state.currentNode}`);
        console.log(`   Node traversal path: ${JSON.stringify(state.context.node_traversed || [], null, 2)}`);

        // Log iteration end
        await this.logger.logIterationEnd({
          iteration: iterations,
          nextNode: state.currentNode,
          conversationEnded: false,
          sessionId: state.sessionId,
        });
        break;
      }

      if (nextNodeOrGoal === 'CONFIRM_RESOLUTION' && transitionResult.shouldTransition) {
        console.log(`\n👋 [CONVERSATION ENDING - RESOLUTION CONFIRMED]`);
        console.log(`   Ending conversation with status: Completed`);
        state = this.contextManager.endConversation(state, 'Completed');
        console.log(`   conversationEnded: ${state.conversationEnded}`);
        console.log(`   endReason: ${state.endReason}`);

        // Log iteration end
        await this.logger.logIterationEnd({
          iteration: iterations,
          nextNode: nextNodeOrGoal,
          conversationEnded: true,
          endReason: state.endReason,
          sessionId: state.sessionId,
        });
        break;
      }

      // Move to next goal if transition is needed
      if (transitionResult.shouldTransition && transitionResult.nextGoal) {
        console.log(`\n🚀 [GOAL TRANSITION]`);
        console.log(`   FROM: ${state.currentNode}`);
        console.log(`   TO: ${transitionResult.nextGoal}`);

        const previousGoal = state.currentNode;
        state = this.contextManager.updateCurrentNode(state, transitionResult.nextGoal);

        // Write context file after navigation
        await this.writeContextFile(state, `goal_transition:${previousGoal}→${transitionResult.nextGoal}`);

        console.log(`   ✅ Transition complete`);
        console.log(`   New current goal: ${state.currentNode}`);
        console.log(`   Previous goal: ${state.previousNode || 'N/A'}`);

        // In goal-based architecture, transitions between goals are typically stepwise
        // (wait for user input between goals). Auto-advance would be within a goal's sub-tasks.
        // For now, always break after goal transition.
        console.log(`\n💬 [TURN COMPLETE - GOAL TRANSITION]`);
        console.log(`   Transitioned to new goal: ${transitionResult.nextGoal}`);
        console.log(`   Breaking loop to wait for next user message`);
        console.log(`   Final state context:`);
        console.log(`     - currentGoal: ${state.currentNode}`);
        console.log(`     - customers_main_ask: ${state.context.data_extraction_fields?.customers_main_ask || '(not set)'}`);
        console.log(`     - customer_phone_number: ${state.context.data_extraction_fields?.customer_phone_number || '(not set)'}`);

        // Log iteration end
        await this.logger.logIterationEnd({
          iteration: iterations,
          nextNode: state.currentNode,
          conversationEnded: false,
          sessionId: state.sessionId,
        });
        break;
      }

      // No transition: stay in current goal and wait for user input
      console.log(`\n💬 [TURN COMPLETE - STAYING IN GOAL]`);
      console.log(`   Remaining in goal: ${state.currentNode}`);
      console.log(`   Breaking loop to wait for next user message`);
      console.log(`   Final state context:`);
      console.log(`     - currentGoal: ${state.currentNode}`);
      console.log(`     - customers_main_ask: ${state.context.data_extraction_fields?.customers_main_ask || '(not set)'}`);
      console.log(`     - customer_phone_number: ${state.context.data_extraction_fields?.customer_phone_number || '(not set)'}`);

      // Log iteration end
      await this.logger.logIterationEnd({
        iteration: iterations,
        nextNode: state.currentNode,
        conversationEnded: false,
        sessionId: state.sessionId,
      });
      break;
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
    // Ensure SessionMemoryDataService is initialized
    await this.initializeSessionMemoryData();

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
