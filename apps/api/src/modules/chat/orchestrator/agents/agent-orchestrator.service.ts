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
import type { DAGConfiguration } from './dag-types.js';
import {
  AgentContextManager,
  getAgentContextManager,
  type AgentContextState
} from './agent-context.service.js';
import { WorkerReplyAgent, createWorkerReplyAgent } from './worker-reply-agent.service.js';
import { WorkerMCPAgent, createWorkerMCPAgent } from './worker-mcp-agent.service.js';
import { NavigatorAgent, createNavigatorAgent } from './navigator-agent.service.js';
import { DataExtractionAgent, createDataExtractionAgent } from './data-extraction-agent.service.js';
import { getLLMLogger } from '../services/llm-logger.service.js';

/**
 * Agent Orchestrator Service
 * Main service that coordinates multi-agent workflow
 */
export class AgentOrchestratorService {
  private stateManager: StateManager;
  private mcpAdapter: MCPAdapterService;
  private contextManager: AgentContextManager;
  private dagConfig!: DAGConfiguration;
  private logger = getLLMLogger();

  private workerReplyAgent!: WorkerReplyAgent;
  private workerMCPAgent!: WorkerMCPAgent;
  private navigatorAgent!: NavigatorAgent;
  private dataExtractionAgent!: DataExtractionAgent;

  // In-memory state cache (replace LangGraph checkpointer)
  private stateCache: Map<string, AgentContextState> = new Map();

  // Context file directory
  private contextDir: string = './logs/contexts';

  constructor() {
    this.stateManager = new StateManager();
    this.mcpAdapter = new MCPAdapterService();
    this.contextManager = getAgentContextManager();

    console.log('[AgentOrchestrator] 🚀 Initializing pure agent-based system');
    this.initializeContextDir();
    this.initializeAgents();
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
   * Write context to JSON file - DIRECT FILE WRITE
   */
  private async writeContextFile(state: AgentContextState, action: string = 'update'): Promise<void> {
    try {
      const filePath = this.getContextFilePath(state.sessionId);

      const snapshot = {
        metadata: {
          sessionId: state.sessionId,
          chatSessionId: state.chatSessionId,
          userId: state.userId,
          currentNode: state.currentNode,
          previousNode: state.previousNode,
          completed: state.completed,
          conversationEnded: state.conversationEnded,
          endReason: state.endReason,
          lastUpdated: new Date().toISOString(),
          action,
        },
        context: state.context,
        messages: state.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })),
        statistics: {
          totalMessages: state.messages.length,
          userMessages: state.messages.filter(m => m.role === 'user').length,
          assistantMessages: state.messages.filter(m => m.role === 'assistant').length,
          nodesTraversed: state.context.node_traversed?.length || 0,
          flagsSet: Object.values(state.context.flags || {}).filter(v => v === 1).length,
        },
      };

      await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');

      const truncatedId = state.sessionId.substring(0, 8);
      const shortAction = action.length > 50 ? action.substring(0, 47) + '...' : action;
      console.log(`[AgentOrchestrator] 💾 session_${truncatedId}..._memory_data.json (${shortAction})`);

      // ========================================================================
      // DUMP COMPLETE CONTEXT JSON FILE TO LOGS (User Requested)
      // ========================================================================
      console.log(`\n┌════════════════════════════════════════════════════════════════════┐`);
      console.log(`│ 📄 COMPLETE CONTEXT JSON FILE - ${shortAction.padEnd(40)} │`);
      console.log(`│ File: session_${truncatedId}_memory_data.json${' '.repeat(30 - truncatedId.length)}│`);
      console.log(`└════════════════════════════════════════════════════════════════════┘`);
      console.log(JSON.stringify(snapshot, null, 2));
      console.log(`┌════════════════════════════════════════════════════════════════════┐`);
      console.log(`│ END OF CONTEXT JSON FILE${' '.repeat(44)}│`);
      console.log(`└════════════════════════════════════════════════════════════════════┘\n`);
    } catch (error: any) {
      console.error(`[AgentOrchestrator] ❌ Failed to write context file: ${error.message}`);
    }
  }

  /**
   * Read context from JSON file - DIRECT FILE READ
   */
  private async readContextFile(sessionId: string): Promise<any | null> {
    try {
      const filePath = this.getContextFilePath(sessionId);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`[AgentOrchestrator] ❌ Failed to read context file: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Initialize agents from agent configuration
   */
  private async initializeAgents(): Promise<void> {
    try {
      const configLoader = getAgentConfigLoader();
      this.dagConfig = await configLoader.loadAgentConfig();

      // Pass agent config to context manager for deterministic initialization
      this.contextManager.setDAGConfig(this.dagConfig);

      // Initialize THREE worker agents:
      // 1. WorkerReplyAgent - generates customer-facing responses
      // 2. WorkerMCPAgent - executes MCP tools and updates context
      // 3. DataExtractionAgent - extracts context from conversation (called AFTER worker agents)
      this.workerReplyAgent = createWorkerReplyAgent(this.dagConfig);
      this.workerMCPAgent = createWorkerMCPAgent(this.dagConfig, this.mcpAdapter);
      this.navigatorAgent = createNavigatorAgent(this.dagConfig);
      this.dataExtractionAgent = createDataExtractionAgent();

      console.log('[AgentOrchestrator] ✅ Agents initialized');
      console.log('[AgentOrchestrator]    - WorkerReplyAgent: Customer-facing responses');
      console.log('[AgentOrchestrator]    - WorkerMCPAgent: MCP tool execution');
      console.log('[AgentOrchestrator]    - DataExtractionAgent: Context extraction (post-processing)');
      console.log('[AgentOrchestrator]    - NavigatorAgent: Routing decisions');
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
        // Finalize context file
        await this.writeContextFile(state, 'finalize');

        // Log session end
        await this.logger.logSessionEnd({
          sessionId,
          endReason: state.endReason || 'unknown',
          totalIterations: state.context.node_traversed?.length || 0,
          totalMessages: state.messages.length,
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

    while (iterations < maxIterations) {
      iterations++;
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🔄 ITERATION ${iterations} - Current Node: ${state.currentNode}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Log iteration start
      await this.logger.logIterationStart(
        iterations,
        state.sessionId,
        state.currentNode,
        iterations === 1 ? userMessage : undefined
      );

      // Log user message if present
      if (iterations === 1 && userMessage) {
        console.log(`[AgentOrchestrator] 👤 USER_MESSAGE: ${userMessage}`);
      }

      // Log COMPLETE context data - show ALL fields being built
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📊 [COMPLETE CONTEXT STATE - Iteration ${iterations}]`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Current execution state
      console.log(`\n🎯 EXECUTION STATE:`);
      console.log(`   Current Node: ${state.currentNode}`);
      console.log(`   Previous Node: ${state.previousNode || '(none)'}`);
      console.log(`   Loop Back Intention: ${state.loopBackIntention || '(none)'}`);
      console.log(`   Conversation Ended: ${state.conversationEnded ? 'YES' : 'NO'}`);
      if (state.endReason) console.log(`   End Reason: ${state.endReason}`);

      // Navigation history
      console.log(`\n🗺️  NODE TRAVERSAL HISTORY (${state.context.node_traversed?.length || 0} nodes):`);
      console.log(`   ${JSON.stringify(state.context.node_traversed || [], null, 2)}`);

      // Core identification fields
      console.log(`\n👤 CUSTOMER IDENTIFICATION:`);
      console.log(`   ✓ customer_name: ${state.context.data_extraction_fields?.customer_name || '(not set)'}`);
      console.log(`   ✓ customer_phone_number: ${state.context.data_extraction_fields?.customer_phone_number || '(not set)'}`);
      console.log(`   ✓ customer_id: ${state.context.data_extraction_fields?.customer_id || '(not set)'}`);

      // Problem/need fields
      console.log(`\n🎯 CUSTOMER NEED/PROBLEM:`);
      console.log(`   ✓ customers_main_ask: ${state.context.data_extraction_fields?.customers_main_ask || '(not set)'}`);
      console.log(`   ✓ related_entities_for_customers_ask: ${state.context.related_entities_for_customers_ask || '(not set)'}`);

      // Service matching
      console.log(`\n🔧 SERVICE MATCHING:`);
      console.log(`   ✓ matching_service_catalog_to_solve_customers_issue: ${state.context.data_extraction_fields?.matching_service_catalog_to_solve_customers_issue || '(not set)'}`);

      // Task/booking fields
      console.log(`\n📅 TASK/BOOKING:`);
      console.log(`   ✓ task_id: ${state.context.data_extraction_fields?.task_id || '(not set)'}`);
      console.log(`   ✓ appointment_details: ${state.context.data_extraction_fields?.appointment_details || '(not set)'}`);

      // Navigation/planning fields
      console.log(`\n🧭 NAVIGATION/PLANNING:`);
      console.log(`   ✓ next_node_to_go_to: ${state.context.next_node_to_go_to || '(not set)'}`);
      console.log(`   ✓ next_course_of_action: ${state.context.next_course_of_action || '(not set)'}`);

      // Conversation history (from messages array)
      const conversationCount = Math.floor((state.messages?.length || 0) / 2); // Pairs of user+agent
      console.log(`\n💬 CONVERSATION HISTORY (${conversationCount} exchanges, ${state.messages?.length || 0} total messages)`);

      // Agent profile
      console.log(`\n🤖 AGENT PROFILE:`);
      console.log(`   ✓ who_are_you: ${state.context.who_are_you || '(not set)'}`);
      console.log(`   ✓ agent_session_id: ${state.context.agent_session_id || '(not set)'}`);

      // Raw context dump
      console.log(`\n📋 RAW CONTEXT OBJECT (JSON):`);
      console.log(JSON.stringify(state.context, null, 2));

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Log full context state to llm.log
      await this.logger.logContextState(state, 'CONTEXT BEFORE EXECUTION');

      // Check if conversation has ended
      if (state.conversationEnded) {
        console.log(`[AgentOrchestrator] ✅ Conversation ended: ${state.endReason}`);
        break;
      }

      // Detect loop-back intention BEFORE executing node
      // Check if current node was reached via a loop-back condition
      loopBackIntention = undefined; // Reset for this iteration
      state.loopBackIntention = undefined; // Clear from state
      if (iterations > 1 && state.previousNode) {
        const prevNodeConfig = this.dagConfig.nodes.find(n => n.node_name === state.previousNode);
        if (prevNodeConfig?.branching_conditions) {
          const matchedCondition = prevNodeConfig.branching_conditions.find(
            (bc: any) => bc.child_node === state.currentNode
          );
          if (matchedCondition?.loop_back_intention) {
            loopBackIntention = matchedCondition.loop_back_intention;
            state.loopBackIntention = loopBackIntention; // Set in state for agents to use
            console.log(`\n🔄 [LOOP-BACK CONTEXT]`);
            console.log(`   Previous node: ${state.previousNode}`);
            console.log(`   Current node: ${state.currentNode}`);
            console.log(`   Loop-back intention: ${loopBackIntention}`);

            // Reset context fields if specified in branching condition
            if (matchedCondition?.context_reset && Array.isArray(matchedCondition.context_reset)) {
              console.log(`   🔄 Resetting context fields: ${matchedCondition.context_reset.join(', ')}`);
              const resetUpdates: any = {};
              matchedCondition.context_reset.forEach((field: string) => {
                resetUpdates[field] = ''; // Reset to empty string
                console.log(`      - ${field}: "${state.context[field]}" → "" (cleared for re-gathering)`);
              });
              state = this.contextManager.updateContext(state, resetUpdates);
            }

            console.log(`   ⚠️  This is INTERNAL context for the LLM - NOT shown to customer\n`);
          }
        }
      }

      // STEP 1: Choose correct worker agent based on node.agent_profile_type
      const currentNodeConfig = this.dagConfig.nodes.find(n => n.node_name === state.currentNode);
      const agentProfileType = currentNodeConfig?.agent_profile_type || 'worker_reply_agent';

      console.log(`[AgentOrchestrator] 🎯 Node: ${state.currentNode}, Agent Type: ${agentProfileType}`);

      let response: string = '';
      let contextUpdates: any = {};

      if (agentProfileType === 'worker_mcp_agent') {
        // Use WorkerMCPAgent for MCP operations
        console.log(`[AgentOrchestrator] 🔧 Executing WorkerMCPAgent`);
        const mcpResult = await this.workerMCPAgent.executeNode(state.currentNode, state);

        console.log(`\n📝 [WORKER MCP RESULT]`);
        console.log(`   Status: "${mcpResult.statusMessage}"`);
        console.log(`   Context Updates: ${JSON.stringify(mcpResult.contextUpdates, null, 2)}`);
        console.log(`   MCP Executed: ${mcpResult.mcpExecuted}`);

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
        console.log(`[AgentOrchestrator] 🗣️  Executing WorkerReplyAgent`);
        const replyResult = await this.workerReplyAgent.executeNode(
          state.currentNode,
          state,
          iterations === 1 ? userMessage : undefined
        );

        console.log(`\n📝 [WORKER REPLY RESULT]`);
        console.log(`   Response: "${replyResult.response.substring(0, 100)}${replyResult.response.length > 100 ? '...' : ''}"`);

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

      // Update state with worker results FIRST
      if (response) {
        state = this.contextManager.addAssistantMessage(state, response);
      }
      if (Object.keys(contextUpdates).length > 0) {
        state = this.contextManager.updateContext(state, contextUpdates);
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP: Call DataExtractionAgent AFTER worker agents complete
      // This agent analyzes conversation and extracts missing context fields
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (agentProfileType === 'worker_reply_agent' || agentProfileType === 'worker_mcp_agent') {
        console.log(`\n[AgentOrchestrator] 🔍 Calling DataExtractionAgent for post-processing...`);

        const extractionResult = await this.dataExtractionAgent.extractAndUpdateContext(state);

        console.log(`\n📊 [DATA EXTRACTION RESULT]`);
        console.log(`   Extraction Reason: ${extractionResult.extractionReason}`);

        if (extractionResult.fieldsUpdated && extractionResult.fieldsUpdated.length > 0) {
          console.log(`   Fields Updated: ${extractionResult.fieldsUpdated.join(', ')}`);
          console.log(`   Context Updates: ${JSON.stringify(extractionResult.contextUpdates, null, 2)}`);

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

      // REMOVED: summary_of_conversation_on_each_step_until_now (duplicate of messages array)
      // DataExtractionAgent now reads from state.messages directly

      // Log conversation turn to llm.log (only on first iteration)
      if (iterations === 1 && userMessage && response) {
        await this.logger.logConversationTurn({
          userMessage,
          aiResponse: response,
          sessionId: state.sessionId,
        });
      }

      // CRITICAL: Track node execution by appending to node_traversed
      // This enables Navigator to make decisions based on which nodes have been visited
      const currentPath = state.context.node_traversed || [];
      if (!currentPath.includes(state.currentNode)) {
        state = this.contextManager.updateContext(state, {
          node_traversed: [state.currentNode]  // Will be appended by non-destructive merge
        });
        console.log(`[AgentOrchestrator] 🗺️  Added ${state.currentNode} to node_traversed (total: ${(state.context.node_traversed || []).length})`);
      } else {
        console.log(`[AgentOrchestrator] 🗺️  ${state.currentNode} already in node_traversed (skipping duplicate)`);
      }

      // Write context file after worker execution
      await this.writeContextFile(state, `node:${state.currentNode}`);

      // Show what changed after worker execution
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
      const msgCount = Math.floor((state.messages?.length || 0) / 2);
      console.log(`\n💬 CONVERSATION (${msgCount} exchanges, ${state.messages?.length || 0} messages)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // STEP 2: Navigator Agent decides next node AFTER execution
      console.log(`[AgentOrchestrator] 🧭 Consulting Navigator for next step...`);
      const navigatorDecision = await this.navigatorAgent.decideNextNode(state);

      console.log(`\n🧭 [NAVIGATOR DECISION]`);
      console.log(`   Validation: ${navigatorDecision.validationStatus.onTrack ? '✅ ON TRACK' : '⚠️ OFF TRACK'}`);
      console.log(`   Reason: ${navigatorDecision.validationStatus.reason}`);
      console.log(`   Current Node: ${state.currentNode}`);
      console.log(`   Next Node: ${navigatorDecision.nextNode}`);
      console.log(`   Matched Condition: ${navigatorDecision.matchedCondition || 'Using default_next_node'}`);
      console.log(`   Next Action: ${navigatorDecision.nextCourseOfAction}`);
      console.log(`   Routing Reason: ${navigatorDecision.reason}`);
      if (navigatorDecision.mcpToolsNeeded && navigatorDecision.mcpToolsNeeded.length > 0) {
        console.log(`   MCP Tools Needed: ${navigatorDecision.mcpToolsNeeded.join(', ')}`);
      }

      // Log navigator decision to llm.log
      await this.logger.logNavigatorDecision({
        currentNode: state.currentNode,
        decision: navigatorDecision.validationStatus.onTrack ? 'On Track' : 'Off Track',
        nextNode: navigatorDecision.nextNode,
        reason: navigatorDecision.reason,
        sessionId: state.sessionId,
      });

      // Log validation status if off-track
      if (!navigatorDecision.validationStatus.onTrack) {
        console.log(`\n⚠️ [VALIDATION WARNING]`);
        console.log(`   Off-track reason: ${navigatorDecision.validationStatus.reason}`);
      }

      // Update context with navigator decisions
      state = this.contextManager.updateContext(state, {
        next_node_to_go_to: navigatorDecision.nextNode,
        next_course_of_action: navigatorDecision.nextCourseOfAction,
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // LOOP DETECTION SAFEGUARD
      // Prevent infinite loops by detecting when same node is visited 3+ times
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const recentNodes = (state.context.node_traversed || []).slice(-6); // Last 6 nodes
      const nextNodeCount = recentNodes.filter(n => n === navigatorDecision.nextNode).length;

      if (nextNodeCount >= 3) {
        console.log(`\n🚨 [LOOP DETECTION] ${navigatorDecision.nextNode} visited ${nextNodeCount} times in last 6 nodes`);
        console.log(`   Recent path: ${JSON.stringify(recentNodes)}`);
        console.log(`   🔧 FORCING ESCAPE from infinite loop...`);

        // Find the node configuration
        const currentNodeConfig = this.dagConfig.nodes.find(n => n.node_name === state.currentNode);

        // Escape strategy based on node type
        if (navigatorDecision.nextNode === 'Try_To_Gather_Customers_Data') {
          // Force move to next node even if data is missing
          console.log(`   🔧 Forcing escape: Try_To_Gather_Customers_Data → Check_IF_existing_customer`);
          console.log(`   ⚠️  WARNING: Moving forward with incomplete data to prevent loop`);
          navigatorDecision.nextNode = 'Check_IF_existing_customer';
        } else if (navigatorDecision.nextNode === 'ASK_CUSTOMER_ABOUT_THEIR_NEED') {
          // Force move to next step
          console.log(`   🔧 Forcing escape: ASK_CUSTOMER_ABOUT_THEIR_NEED → Extract_Customer_Issue`);
          navigatorDecision.nextNode = 'Extract_Customer_Issue';
        } else if (currentNodeConfig?.default_next_node) {
          // Generic escape: use default_next_node
          console.log(`   🔧 Forcing escape: ${navigatorDecision.nextNode} → ${currentNodeConfig.default_next_node}`);
          navigatorDecision.nextNode = currentNodeConfig.default_next_node;
        } else {
          // Last resort: skip to Goodbye
          console.log(`   🔧 Forcing escape: ${navigatorDecision.nextNode} → Goodbye_And_Hangup (last resort)`);
          navigatorDecision.nextNode = 'Goodbye_And_Hangup';
        }

        // Update context with forced escape
        state = this.contextManager.updateContext(state, {
          next_node_to_go_to: navigatorDecision.nextNode,
          next_course_of_action: `LOOP DETECTED - Forced escape from infinite loop`,
        });

        // Log to llm.log
        await this.logger.logAgentExecution({
          agentType: 'loop_detection',
          nodeName: state.currentNode,
          result: {
            loopDetected: true,
            originalNextNode: recentNodes[recentNodes.length - 1],
            forcedNextNode: navigatorDecision.nextNode,
            recentPath: recentNodes
          },
          sessionId: state.sessionId,
        });
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

      // Log Navigator's decision
      console.log(`[AgentOrchestrator] ➡️  Navigator decision: ${state.currentNode} → ${navigatorDecision.nextNode}`);

      // STEP 3: FORCE transition to next node (no questions asked)

      // Check if we should end conversation
      if (navigatorDecision.nextNode === 'END') {
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

      if (navigatorDecision.nextNode === 'Goodbye_And_Hangup') {
        console.log(`\n👋 [CONVERSATION ENDING]`);
        console.log(`   Ending conversation with status: Completed`);
        state = this.contextManager.endConversation(state, 'Completed');
        console.log(`   conversationEnded: ${state.conversationEnded}`);
        console.log(`   endReason: ${state.endReason}`);

        // Log iteration end
        await this.logger.logIterationEnd({
          iteration: iterations,
          nextNode: navigatorDecision.nextNode,
          conversationEnded: true,
          endReason: state.endReason,
          sessionId: state.sessionId,
        });
        break;
      }

      // FORCE move to next node - Navigator's decision is final
      console.log(`\n🚀 [STATE TRANSITION]`);
      console.log(`   FROM: ${state.currentNode}`);
      console.log(`   TO: ${navigatorDecision.nextNode}`);

      const previousNode = state.currentNode;
      state = this.contextManager.updateCurrentNode(state, navigatorDecision.nextNode);

      // Write context file after navigation
      await this.writeContextFile(state, `navigation:${previousNode}→${navigatorDecision.nextNode}`);

      console.log(`   ✅ Transition complete`);
      console.log(`   New current node: ${state.currentNode}`);
      console.log(`   Previous node: ${state.previousNode || 'N/A'}`);

      // Check advance_type from the matched branching condition
      // If the transition was made via a branching condition with advance_type='auto', continue
      // If advance_type='stepwise' or no match, break and wait for user
      const prevNodeConfig = this.dagConfig.nodes.find(n => n.node_name === previousNode);
      let shouldAutoAdvance = false;
      let matchedBranchingCondition: any = null;

      // Find the branching condition that led to the current node
      if (prevNodeConfig?.branching_conditions) {
        matchedBranchingCondition = prevNodeConfig.branching_conditions.find(
          (bc: any) => bc.child_node === state.currentNode
        );

        if (matchedBranchingCondition) {
          shouldAutoAdvance = matchedBranchingCondition.advance_type === 'auto';
          console.log(`\n🔀 [ROUTING TYPE]`);
          console.log(`   Matched branching condition: ${matchedBranchingCondition.condition || '(no condition text)'}`);
          console.log(`   Advance type: ${matchedBranchingCondition.advance_type || '(not set)'}`);
          console.log(`   Child node: ${matchedBranchingCondition.child_node}`);
        }
      }

      // If no matching condition found, check if transition was via default_next_node
      if (!matchedBranchingCondition && prevNodeConfig?.default_next_node === state.currentNode) {
        console.log(`\n🔀 [ROUTING TYPE]`);
        console.log(`   Used default_next_node (no branching condition matched)`);
        console.log(`   Advance type: stepwise (default behavior)`);
        shouldAutoAdvance = false;
      }

      // Auto-advance: continue to next iteration immediately
      if (shouldAutoAdvance && iterations < maxIterations) {
        console.log(`\n⚡ [AUTO-ADVANCE ENABLED]`);
        console.log(`   Transition has advance_type='auto'`);
        console.log(`   Continuing to execute next node without waiting for user input...`);
        continue; // Don't break - continue the loop
      }

      // Stepwise: break and wait for user response
      console.log(`\n💬 [TURN COMPLETE - STEPWISE]`);
      console.log(`   Transition has advance_type='stepwise' or default`);
      console.log(`   Breaking loop to wait for next user message`);
      console.log(`   Final state context:`);
      console.log(`     - currentNode: ${state.currentNode}`);
      console.log(`     - customers_main_ask: ${state.context.data_extraction_fields?.customers_main_ask || '(not set)'}`);
      console.log(`     - customer_phone_number: ${state.context.data_extraction_fields?.customer_phone_number || '(not set)'}`);
      console.log(`     - flags: ${JSON.stringify(state.context.flags || {}, null, 2)}`);

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
