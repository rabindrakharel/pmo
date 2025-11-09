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
import { ParallelAgentExecutor, createParallelAgentExecutor, type AgentExecutor } from '../engines/parallel-agent-executor.js';
import { getLLMLogger } from '../services/llm-logger.service.js';
import { createAgentLogger, type AgentLogger } from '../services/agent-logger.service.js';
import { getSessionMemoryDataService } from '../services/session-memory-data.service.js';
import type { SessionMemoryData } from '../services/session-memory-data.service.js';
import { getSessionMemoryQueueService } from '../services/session-memory-queue.service.js';

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
  private parallelExecutor!: ParallelAgentExecutor;

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

    console.log('[AgentOrchestrator] 🚀 Initializing pure agent-based system with LowDB + RabbitMQ');
    this.initializeSessionMemoryData();
    this.initializeSessionMemoryQueue();
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
   * Initialize RabbitMQ for session memory queue
   * Falls back gracefully if RabbitMQ is not available
   */
  private async initializeSessionMemoryQueue(): Promise<void> {
    try {
      const queueService = getSessionMemoryQueueService();
      await queueService.initialize();
      await queueService.startConsumer();
      console.log(`[AgentOrchestrator] 🐰 RabbitMQ queue initialized and consumer started`);
    } catch (error: any) {
      console.warn(`[AgentOrchestrator] ⚠️  RabbitMQ not available, continuing without queue: ${error.message}`);
      console.warn(`[AgentOrchestrator] ℹ️  Session memory updates will be processed directly (synchronous mode)`);
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
        context: state.context as any, // DAGContext is dynamically initialized from config
        messages: (state.messages || []).map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
        })),
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
      // 1. WorkerReplyAgent - generates customer-facing responses (uses conversational_agent profile)
      // 2. WorkerMCPAgent - executes MCP tools and updates context (uses mcp_agent profile)
      // 3. DataExtractionAgent - extracts context from conversation (called AFTER worker agents)
      // 4. GoalTransitionEngine - evaluates goal transitions using semantic routing
      // 5. ParallelAgentExecutor - executes agents in parallel for 50%+ performance boost
      this.workerReplyAgent = createWorkerReplyAgent(this.config, 'conversational_agent');
      this.workerMCPAgent = createWorkerMCPAgent(this.config, this.mcpAdapter, undefined, 'mcp_agent');
      this.transitionEngine = new GoalTransitionEngine(this.config);
      this.dataExtractionAgent = createDataExtractionAgent();
      this.parallelExecutor = createParallelAgentExecutor();

      console.log('[AgentOrchestrator] ✅ Agents initialized (Goal-Oriented Architecture v3.0)');
      console.log('[AgentOrchestrator]    - WorkerReplyAgent: Customer-facing responses');
      console.log('[AgentOrchestrator]    - WorkerMCPAgent: MCP tool execution');
      console.log('[AgentOrchestrator]    - DataExtractionAgent: Context extraction (post-processing)');
      console.log('[AgentOrchestrator]    - GoalTransitionEngine: Semantic goal routing');
      console.log('[AgentOrchestrator]    - ParallelAgentExecutor: Parallel agent execution');
      console.log(`[AgentOrchestrator] Total goals: ${this.config.goals.length}`);
      console.log(`[AgentOrchestrator] Agent profiles: ${Object.keys(this.config.agent_profiles).join(', ')}`);
    } catch (error: any) {
      console.error('[AgentOrchestrator] ❌ Failed to initialize agents:', error.message);
      throw error;
    }
  }

  /**
   * Process user message with STREAMING (yields tokens as they arrive)
   * Same as processMessage but streams the agent's response
   */
  async *processMessageStream(args: {
    sessionId?: string;
    message: string;
    chatSessionId?: string;
    userId?: string;
    authToken?: string;
  }): AsyncGenerator<{
    type: 'token' | 'done' | 'error';
    token?: string;
    sessionId?: string;
    response?: string;
    currentNode?: string;
    conversationEnded?: boolean;
    endReason?: string;
    error?: string;
  }> {
    // Note: Race conditions now handled by RabbitMQ queue (sequential processing per session)
    let sessionId = args.sessionId;

    try {
      // Ensure SessionMemoryDataService is initialized
      await this.initializeSessionMemoryData();

      // Ensure agents are initialized
      if (!this.config) {
        await this.initializeAgents();
      }

      let state: AgentContextState;

      if (!sessionId) {
        // New session
        sessionId = uuidv4();
        console.log(`\n[AgentOrchestrator] 🆕 New streaming session ${sessionId}`);

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
        console.log(`\n[AgentOrchestrator] 📂 Resuming streaming session ${sessionId}`);
        state = await this.loadState(sessionId);
      }

      // Stream response from worker agent
      let fullResponse = '';

      for await (const chunk of this.workerReplyAgent.executeGoalStream(
        state.currentNode,
        state,
        args.message
      )) {
        if (chunk.done) {
          // Final chunk - prepare completion data
          fullResponse = chunk.response || fullResponse;

          // Update conversation summary
          state = this.contextManager.appendConversationSummary(
            state,
            args.message,
            fullResponse
          );

          // Run data extraction (non-streaming)
          const currentExchange = { customer: args.message, agent: fullResponse };
          const extractionResult = await this.dataExtractionAgent.extractAndUpdateContext(
            state,
            currentExchange
          );

          if (extractionResult.fieldsUpdated && extractionResult.fieldsUpdated.length > 0) {
            state = this.contextManager.updateContext(state, extractionResult.contextUpdates || {});
          }

          // Save state
          await this.saveState(state);

          // Update session in database
          await this.stateManager.updateSession(sessionId, {
            current_node: state.currentNode,
            status: state.completed ? 'completed' : 'active',
          });

          // Yield final metadata
          yield {
            type: 'done',
            sessionId,
            response: fullResponse,
            currentNode: state.currentNode,
            conversationEnded: state.conversationEnded,
            endReason: state.endReason,
          };
        } else {
          // Token chunk - yield to client immediately
          fullResponse += chunk.token;
          yield {
            type: 'token',
            token: chunk.token,
          };
        }
      }
    } catch (error: any) {
      console.error('[AgentOrchestrator] ❌ Error streaming message:', error);
      yield {
        type: 'error',
        error: error.message,
      };
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

      // STEP 1: Choose correct worker agent based on current goal configuration
      // Use declarative goal.primary_agent instead of hardcoding logic
      const currentGoalConfig = this.config.goals.find(g => g.goal_id === state.currentNode);
      if (!currentGoalConfig) {
        console.warn(`[AgentOrchestrator] ⚠️ Goal not found: ${state.currentNode}, using default`);
      }

      // Check if goal has parallel execution strategy
      const executionStrategy = (currentGoalConfig as any)?.agent_execution_strategy;

      let response: string = '';
      let contextUpdates: any = {};
      let primaryAgentFailed = false;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PARALLEL EXECUTION: If goal has execution strategy, use it
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (executionStrategy && executionStrategy.mode !== 'sequential') {
        console.log(`\n⚡ [PARALLEL EXECUTION] Mode: ${executionStrategy.mode}`);

        // Build agent executor map
        const agentExecutors = new Map<string, AgentExecutor>();

        // Add worker reply agent
        agentExecutors.set('conversational_agent', {
          agentId: 'conversational_agent',
          execute: async (state: AgentContextState, userMessage?: string) => {
            return await this.workerReplyAgent.executeGoal(state.currentNode, state, userMessage);
          }
        });

        // Add data extraction agent
        agentExecutors.set('extraction_agent', {
          agentId: 'extraction_agent',
          execute: async (state: AgentContextState, userMessage?: string) => {
            const currentExchange = userMessage ? { customer: userMessage, agent: '' } : undefined;
            return await this.dataExtractionAgent.extractAndUpdateContext(state, currentExchange);
          }
        });

        // Add MCP agent if needed
        agentExecutors.set('mcp_agent', {
          agentId: 'mcp_agent',
          execute: async (state: AgentContextState) => {
            return await this.workerMCPAgent.executeGoal(state.currentNode, state);
          }
        });

        // Execute agents in parallel
        const parallelResult = await this.parallelExecutor.executeAgents(
          executionStrategy,
          agentExecutors,
          state,
          iterations === 1 ? userMessage : undefined
        );

        console.log(`\n   Execution time: ${parallelResult.executionTimeMs}ms`);
        console.log(`   Results: ${parallelResult.results.size} agents succeeded`);
        console.log(`   Errors: ${parallelResult.errors.size} agents failed`);

        // Process results
        const replyResult = parallelResult.results.get('conversational_agent');
        const extractionResult = parallelResult.results.get('extraction_agent');
        const mcpResult = parallelResult.results.get('mcp_agent');

        if (replyResult) {
          response = replyResult.response || '';
          console.log(`[ParallelExecution] ✅ Reply agent: "${response.substring(0, 50)}..."`);
        }

        if (extractionResult) {
          if (extractionResult.contextUpdates && Object.keys(extractionResult.contextUpdates).length > 0) {
            contextUpdates = { ...contextUpdates, ...extractionResult.contextUpdates };
            console.log(`[ParallelExecution] ✅ Extraction agent: ${extractionResult.fieldsUpdated?.length || 0} fields updated`);
          }
        }

        if (mcpResult) {
          if (mcpResult.contextUpdates) {
            contextUpdates = { ...contextUpdates, ...mcpResult.contextUpdates };
          }
          response = mcpResult.statusMessage || response;
          console.log(`[ParallelExecution] ✅ MCP agent: ${mcpResult.statusMessage}`);
        }

        // Check for failures
        if (parallelResult.errors.size > 0) {
          console.warn(`[ParallelExecution] ⚠️ Some agents failed:`);
          for (const [agentId, error] of parallelResult.errors.entries()) {
            console.warn(`   - ${agentId}: ${error.message}`);
          }
        }

      } else {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SEQUENTIAL EXECUTION (original behavior)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        // Use goal's primary_agent to determine which agent to use
        const primaryAgent = (currentGoalConfig as any)?.primary_agent || 'conversational_agent';
        const fallbackAgent = (currentGoalConfig as any)?.fallback_agent;
        let agentProfileType = primaryAgent === 'mcp_agent' ? 'worker_mcp_agent' : 'worker_reply_agent';

        console.log(`[AgentOrchestrator] 🎯 Goal: ${state.currentNode}, Primary Agent: ${primaryAgent}${fallbackAgent ? `, Fallback: ${fallbackAgent}` : ''}`);


      if (agentProfileType === 'worker_mcp_agent') {
        // Use WorkerMCPAgent for MCP operations
        try {
          const mcpResult = await this.workerMCPAgent.executeGoal(state.currentNode, state);
          logger.agent('worker_mcp', state.currentNode, mcpResult.statusMessage);

          if (this.VERBOSE_LOGS) {
            console.log(`\n📝 [WORKER MCP RESULT]`);
            console.log(`   Status: "${mcpResult.statusMessage}"`);
            console.log(`   Context Updates: ${JSON.stringify(mcpResult.contextUpdates, null, 2)}`);
            console.log(`   MCP Executed: ${mcpResult.mcpExecuted}`);
          }

          response = mcpResult.statusMessage || '';
          contextUpdates = mcpResult.contextUpdates;

          // Check if MCP agent failed (error in results or no response)
          if (mcpResult.mcpResults?.error || (!response && Object.keys(contextUpdates).length === 0)) {
            primaryAgentFailed = true;
            console.log(`[AgentOrchestrator] ⚠️ Primary MCP agent failed or returned no results`);
          }

          // Log agent execution
          await this.logger.logAgentExecution({
            agentType: 'worker_mcp',
            nodeName: state.currentNode,
            result: mcpResult,
            sessionId: state.sessionId,
          });
        } catch (error: any) {
          primaryAgentFailed = true;
          console.error(`[AgentOrchestrator] ❌ Primary MCP agent error: ${error.message}`);
        }

      } else if (agentProfileType === 'worker_reply_agent') {
        // Use WorkerReplyAgent for customer-facing responses
        try {
          const replyResult = await this.workerReplyAgent.executeGoal(
            state.currentNode,
            state,
            iterations === 1 ? userMessage : undefined
          );
          logger.agent('worker_reply', state.currentNode, replyResult.response);

          response = replyResult.response;

          // Check if reply agent failed (no response)
          if (!response || response.trim() === '') {
            primaryAgentFailed = true;
            console.log(`[AgentOrchestrator] ⚠️ Primary reply agent returned empty response`);
          }

          // Log agent execution
          await this.logger.logAgentExecution({
            agentType: 'worker_reply',
            nodeName: state.currentNode,
            result: replyResult,
            sessionId: state.sessionId,
          });
        } catch (error: any) {
          primaryAgentFailed = true;
          console.error(`[AgentOrchestrator] ❌ Primary reply agent error: ${error.message}`);
        }

      } else if (agentProfileType === 'internal') {
        // Internal nodes (wait_for_customers_reply) - no agent execution needed
        console.log(`[AgentOrchestrator] ⏸️  Internal node - skipping agent execution`);

      } else if (agentProfileType === 'summarizer_agent') {
        // Summarizer agent - could be implemented later
        console.log(`[AgentOrchestrator] 📋 Summarizer node - skipping for now`);

      } else {
        console.warn(`[AgentOrchestrator] ⚠️  Unknown agent_profile_type: ${agentProfileType}`);
      }

      // FALLBACK AGENT: If primary agent failed and fallback is configured, try fallback agent
      if (primaryAgentFailed && fallbackAgent) {
        console.log(`\n🔄 [FALLBACK AGENT TRIGGERED]`);
        console.log(`   Primary agent (${primaryAgent}) failed, trying fallback: ${fallbackAgent}`);

        const fallbackAgentType = fallbackAgent === 'mcp_agent' ? 'worker_mcp_agent' : 'worker_reply_agent';

        try {
          if (fallbackAgentType === 'worker_mcp_agent') {
            const mcpResult = await this.workerMCPAgent.executeGoal(state.currentNode, state);
            response = mcpResult.statusMessage || '';
            contextUpdates = mcpResult.contextUpdates;
            console.log(`[AgentOrchestrator] ✅ Fallback MCP agent succeeded`);

            await this.logger.logAgentExecution({
              agentType: 'worker_mcp',
              nodeName: `${state.currentNode}_fallback`,
              result: mcpResult,
              sessionId: state.sessionId,
            });
          } else if (fallbackAgentType === 'worker_reply_agent') {
            const replyResult = await this.workerReplyAgent.executeGoal(
              state.currentNode,
              state,
              iterations === 1 ? userMessage : undefined
            );
            response = replyResult.response;
            console.log(`[AgentOrchestrator] ✅ Fallback reply agent succeeded`);

            await this.logger.logAgentExecution({
              agentType: 'worker_reply',
              nodeName: `${state.currentNode}_fallback`,
              result: replyResult,
              sessionId: state.sessionId,
            });
          }
        } catch (fallbackError: any) {
          console.error(`[AgentOrchestrator] ❌ Fallback agent also failed: ${fallbackError.message}`);
          // Use a default response if both agents fail
          response = "I apologize, but I'm having trouble processing your request. Could you please try rephrasing?";
        }
      }

      // Log full AI response for log parsing
      if (response) {
        console.log(`[AgentOrchestrator] 🤖 AI_RESPONSE: ${response}`);
      }

      } // End of parallel/sequential execution conditional

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
      // ⚡ SKIP if parallel execution already ran extraction agent
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Skip extraction if we used parallel execution (extraction already ran in parallel)
      const usedParallelExecution = executionStrategy && executionStrategy.mode !== 'sequential';

      if (!usedParallelExecution && response) {
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

      // Evaluate transition
      const transitionResult = await this.transitionEngine.evaluateTransition(
        state.currentNode,
        state.context,
        conversationHistory,
        state.sessionId
      );

      logger.navigate(
        state.currentNode,
        transitionResult.nextGoal || state.currentNode,
        transitionResult.reason
      );

      if (this.VERBOSE_LOGS) {
        console.log(`\n🧭 [GOAL TRANSITION EVALUATION]`);
        console.log(`   Current Goal: ${state.currentNode}`);
        console.log(`   Should Transition: ${transitionResult.shouldTransition ? '✅ YES' : '❌ NO'}`);
        console.log(`   Reason: ${transitionResult.reason}`);
        if (transitionResult.shouldTransition && transitionResult.nextGoal) {
          console.log(`   Next Goal: ${transitionResult.nextGoal}`);
        }
      }

      // Log transition decision to llm.log
      await this.logger.logNavigatorDecision({
        currentNode: state.currentNode,
        decision: transitionResult.shouldTransition ? 'Transition' : 'Stay in Goal',
        nextNode: transitionResult.nextGoal || state.currentNode,
        reason: transitionResult.reason,
        sessionId: state.sessionId,
      });

      // Update context with next goal
      const nextNodeOrGoal = transitionResult.shouldTransition && transitionResult.nextGoal
        ? transitionResult.nextGoal
        : state.currentNode;

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

        // Generate retry guidance using goal's declarative retry_strategy
        let retryGuidance = '';

        // Get goal configuration for retry strategy
        const nextGoalConfig = this.config.goals.find(g => g.goal_id === nextNodeOrGoal);
        const retryStrategy = (nextGoalConfig as any)?.retry_strategy;

        if (retryStrategy && retryStrategy.escalation_messages) {
          // Use declarative escalation messages from goal config
          const escalationTurns = retryStrategy.escalation_turns || [];
          const escalationMessages = retryStrategy.escalation_messages || [];

          // Find which escalation level we're at based on attempt number
          let escalationIndex = -1;
          for (let i = 0; i < escalationTurns.length; i++) {
            if (attemptNumber >= escalationTurns[i]) {
              escalationIndex = i;
            }
          }

          if (escalationIndex >= 0 && escalationIndex < escalationMessages.length) {
            // Use declarative escalation message from config
            retryGuidance = `Attempt #${attemptNumber}. ${escalationMessages[escalationIndex]}`;
            console.log(`[Loop Detection] 📋 Using escalation message (level ${escalationIndex + 1}) from goal config`);
          } else {
            // Default retry message using goal's approach
            retryGuidance = `Attempt #${attemptNumber}. Retry strategy: ${retryStrategy.approach}. Try varying your approach to achieve goal: ${nextNodeOrGoal}`;
          }
        } else {
          // Fallback if no retry strategy defined in goal
          retryGuidance = `Attempt #${attemptNumber}. Try varying your approach to achieve goal: ${nextNodeOrGoal}`;
          console.log(`[Loop Detection] ⚠️ No retry_strategy found for goal: ${nextNodeOrGoal}, using generic retry guidance`);
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

      // Check if we've reached a terminal goal (declarative from config)
      const nextGoalConfig = this.config.goals.find(g => g.goal_id === nextNodeOrGoal);
      const isTerminalGoal = (nextGoalConfig as any)?.is_terminal === true;

      if (isTerminalGoal && transitionResult.shouldTransition) {
        console.log(`\n👋 [CONVERSATION ENDING - TERMINAL GOAL REACHED]`);
        console.log(`   Terminal Goal: ${nextNodeOrGoal}`);
        console.log(`   Description: ${nextGoalConfig?.description}`);

        // Execute termination sequence if configured (declarative goodbye + MCP hangup)
        const terminationSequence = (nextGoalConfig as any)?.termination_sequence;
        if (terminationSequence?.enabled) {
          console.log(`\n🔚 [EXECUTING TERMINATION SEQUENCE]`);
          console.log(`   ${terminationSequence.steps.length} steps configured`);

          let goodbyeMessage = '';

          for (const step of terminationSequence.steps) {
            console.log(`\n   Step ${step.step}: ${step.action}`);

            if (step.action === 'conversational_goodbye') {
              // Generate goodbye message using conversational agent
              console.log(`   Agent: ${step.agent}`);
              console.log(`   Template: "${step.message_template}"`);

              try {
                const goodbyeResult = await this.workerReplyAgent.executeGoal(
                  nextNodeOrGoal,
                  state,
                  undefined
                );
                goodbyeMessage = goodbyeResult.response || step.message_template || 'Thank you! Goodbye!';
                console.log(`   ✅ Goodbye message generated: "${goodbyeMessage}"`);

                // Add goodbye message to conversation summary
                state = this.contextManager.appendConversationSummary(
                  state,
                  '(system: ending conversation)',
                  goodbyeMessage
                );
              } catch (error: any) {
                console.error(`   ❌ Error generating goodbye message: ${error.message}`);
                goodbyeMessage = step.message_template || 'Thank you! Goodbye!';
              }

            } else if (step.action === 'execute_mcp_hangup') {
              // Execute MCP hangup tool
              console.log(`   Agent: ${step.agent}`);
              console.log(`   Tool: ${step.required_tool}`);

              try {
                const mcpResult = await this.workerMCPAgent.executeGoal(nextNodeOrGoal, state);
                console.log(`   ✅ MCP hangup executed successfully`);

                // Log MCP execution
                await this.logger.logAgentExecution({
                  agentType: 'worker_mcp',
                  nodeName: `${nextNodeOrGoal}_hangup`,
                  result: mcpResult,
                  sessionId: state.sessionId,
                });
              } catch (error: any) {
                console.error(`   ❌ Error executing MCP hangup: ${error.message}`);
              }
            }
          }

          // Set final response to goodbye message
          response = goodbyeMessage;
        }

        console.log(`\n   Ending conversation with status: Completed`);
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
   * Save state to cache and queue for database persistence
   * Uses RabbitMQ queue to prevent race conditions on session memory data writes
   * No fallback - RabbitMQ is required for proper operation
   */
  private async saveState(state: AgentContextState): Promise<void> {
    // Save to cache (immediate)
    this.stateCache.set(state.sessionId, state);

    // Publish to RabbitMQ queue (sequential processing per session)
    const queueService = getSessionMemoryQueueService();

    // Build session memory data from state
    const sessionData = {
      sessionId: state.sessionId,
      chatSessionId: state.chatSessionId,
      userId: state.userId,
      currentNode: state.currentNode,
      previousNode: state.previousNode,
      completed: state.completed,
      conversationEnded: state.conversationEnded,
      endReason: state.endReason,
      conversations: state.context.summary_of_conversation_on_each_step_until_now || [],
      context: state.context
    };

    await queueService.publishUpdate({
      sessionId: state.sessionId,
      operation: 'update',
      data: sessionData,
      timestamp: new Date().toISOString()
    });

    console.log(`[AgentOrchestrator] 📤 State queued for session ${state.sessionId}`);
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
