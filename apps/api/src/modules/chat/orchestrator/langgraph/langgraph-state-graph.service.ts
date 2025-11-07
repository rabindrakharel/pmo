/**
 * LangGraph-based State Graph Orchestrator
 * Full implementation with all features preserved
 * @module orchestrator/langgraph/langgraph-state-graph
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import type { CustomerContext, StepCompletionTracker } from './prompts.config.js';
import type { MCPAdapterService } from '../../mcp-adapter.service.js';
import { config } from '../../../../lib/config.js';
import {
  greetCustomerNode,
  askAboutNeedNode,
  identifyIssueNode,
  empathizeNode,
  buildRapportNode,
  gatherCustomerDataNode,
  checkExistingCustomerNode,
  planActionsNode,
  communicatePlanNode,
  executePlanNode,
  communicateExecutionNode,
  askAnotherRequestNode,
  goodbyeNode,
  hangupNode,
  errorStateNode,
  type AgentState as OriginalAgentState,
} from './graph-nodes.service.js';
import { getDAGStateBridge } from './dag-state-bridge.service.js';
import { getDAGLoader } from './dag-loader.service.js';
import { getNavigationAgent } from './navigation-agent.service.js';

/**
 * 14-Step Node Names (Roman Numerals)
 */
export const NODES = {
  GREET: 'I_greet_customer',
  ASK_NEED: 'II_ask_about_need',
  IDENTIFY: 'III_identify_issue',
  EMPATHIZE: 'IV_empathize',
  RAPPORT: 'V_build_rapport',
  GATHER: 'VI_gather_customer_data',
  CHECK: 'VII_check_existing_customer',
  PLAN: 'VIII_plan_actions',
  COMMUNICATE_PLAN: 'IX_communicate_plan',
  EXECUTE: 'X_execute_plan',
  COMMUNICATE_EXEC: 'XI_communicate_execution',
  ASK_ANOTHER: 'XIb_ask_another_request',
  GOODBYE: 'XII_goodbye',
  HANGUP: 'XIII_hangup',
  ERROR: 'ERROR_STATE',
} as const;

type NodeName = (typeof NODES)[keyof typeof NODES];

/**
 * LangGraph State Annotation
 * Preserves all our custom state structure
 */
export const GraphState = Annotation.Root({
  // Messages array (LangGraph standard)
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),

  // Our custom context with step tracking
  context: Annotation<Partial<CustomerContext>>({
    reducer: (x, y) => ({ ...x, ...y }),
  }),

  // Progress flags (track completed steps to prevent re-execution)
  progress_flags: Annotation<Record<string, boolean>>({
    reducer: (x, y) => ({ ...x, ...y }),
  }),

  // Customer profile
  customer_profile: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
  }),

  // Action planning
  proposed_actions: Annotation<Array<{ name: string; reason: string }>>({
    reducer: (x, y) => [...x, ...y],
  }),
  available_actions: Annotation<Array<{ name: string; reason: string }>>({
    reducer: (x, y) => [...x, ...y],
  }),
  approved_actions: Annotation<Array<{ name: string; reason: string }>>({
    reducer: (x, y) => [...x, ...y],
  }),
  executed_actions: Annotation<Array<{ action: string; status: string; result?: any }>>({
    reducer: (x, y) => [...x, ...y],
  }),

  // Flow control
  current_node: Annotation<string>(),
  conversation_ended: Annotation<boolean>(),
  completed: Annotation<boolean>(),
  end_reason: Annotation<string>(),

  // Internal (not serialized)
  _mcpAdapter: Annotation<MCPAdapterService>(),
  _authToken: Annotation<string>(),
});

export type LangGraphState = typeof GraphState.State;

/**
 * LangGraph State Graph Service
 * Orchestrates the 14-step conversation flow using LangGraph
 */
export class LangGraphStateGraphService {
  private mcpAdapter: MCPAdapterService;
  private graph: any;
  private checkpointer: PostgresSaver;
  private initPromise: Promise<void>;
  private stateBridge = getDAGStateBridge();
  private navigationAgent = getNavigationAgent();

  constructor(mcpAdapter: MCPAdapterService) {
    this.mcpAdapter = mcpAdapter;

    // Initialize asynchronously
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      console.log('[LangGraph] 🔌 Initializing PostgreSQL checkpointer...');

      // Initialize PostgreSQL checkpointer
      this.checkpointer = await PostgresSaver.fromConnString(config.DATABASE_URL);

      // Setup checkpoint table if needed
      await this.checkpointer.setup();

      console.log('[LangGraph] ✅ PostgreSQL checkpointer initialized');

      // Build the graph after checkpointer is ready
      this.graph = this.buildGraph();

      console.log('[LangGraph] ✅ Graph compiled with persistent checkpointing');
    } catch (error) {
      console.error('[LangGraph] ❌ Failed to initialize PostgreSQL checkpointer:', error);
      throw error;
    }
  }

  /**
   * Wait for service to be fully initialized
   */
  private async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Build the LangGraph workflow
   */
  private buildGraph() {
    const workflow = new StateGraph(GraphState);

    // Add all 14 nodes + error node
    workflow.addNode(NODES.GREET, this.wrapNode(greetCustomerNode, NODES.GREET));
    workflow.addNode(NODES.ASK_NEED, this.wrapNode(askAboutNeedNode, NODES.ASK_NEED));
    workflow.addNode(NODES.IDENTIFY, this.wrapNodeWithMCP(identifyIssueNode, NODES.IDENTIFY));
    workflow.addNode(NODES.EMPATHIZE, this.wrapNode(empathizeNode, NODES.EMPATHIZE));
    workflow.addNode(NODES.RAPPORT, this.wrapNode(buildRapportNode, NODES.RAPPORT));
    workflow.addNode(NODES.GATHER, this.wrapNode(gatherCustomerDataNode, NODES.GATHER));
    workflow.addNode(NODES.CHECK, this.wrapNodeWithMCP(checkExistingCustomerNode, NODES.CHECK));
    workflow.addNode(NODES.PLAN, this.wrapNodeWithMCPOnly(planActionsNode, NODES.PLAN));
    workflow.addNode(
      NODES.COMMUNICATE_PLAN,
      this.wrapNode(communicatePlanNode, NODES.COMMUNICATE_PLAN)
    );
    workflow.addNode(NODES.EXECUTE, this.wrapNodeWithMCP(executePlanNode, NODES.EXECUTE));
    workflow.addNode(
      NODES.COMMUNICATE_EXEC,
      this.wrapNode(communicateExecutionNode, NODES.COMMUNICATE_EXEC)
    );
    workflow.addNode(NODES.ASK_ANOTHER, this.wrapNode(askAnotherRequestNode, NODES.ASK_ANOTHER));
    workflow.addNode(NODES.GOODBYE, this.wrapNode(goodbyeNode, NODES.GOODBYE));
    workflow.addNode(NODES.HANGUP, this.wrapNodeForHangup(hangupNode, NODES.HANGUP));
    workflow.addNode(NODES.ERROR, this.wrapNodeForError(errorStateNode, NODES.ERROR));

    // Set entry point
    workflow.addEdge(START, NODES.GREET);

    // Define edges with conditional logic (async for LLM-based routing)
    workflow.addEdge(NODES.GREET, NODES.ASK_NEED);

    workflow.addConditionalEdges(NODES.ASK_NEED, async (state: LangGraphState) =>
      await this.routeFromNode(NODES.ASK_NEED, state)
    );

    workflow.addConditionalEdges(NODES.IDENTIFY, async (state: LangGraphState) =>
      await this.routeFromNode(NODES.IDENTIFY, state)
    );

    workflow.addEdge(NODES.EMPATHIZE, NODES.RAPPORT);
    workflow.addEdge(NODES.RAPPORT, NODES.GATHER);

    workflow.addConditionalEdges(NODES.GATHER, async (state: LangGraphState) =>
      await this.routeFromNode(NODES.GATHER, state)
    );

    workflow.addEdge(NODES.CHECK, NODES.PLAN);
    workflow.addEdge(NODES.PLAN, NODES.COMMUNICATE_PLAN);

    workflow.addConditionalEdges(NODES.COMMUNICATE_PLAN, async (state: LangGraphState) =>
      await this.routeFromNode(NODES.COMMUNICATE_PLAN, state)
    );

    workflow.addEdge(NODES.EXECUTE, NODES.COMMUNICATE_EXEC);
    workflow.addEdge(NODES.COMMUNICATE_EXEC, NODES.ASK_ANOTHER);

    workflow.addConditionalEdges(NODES.ASK_ANOTHER, async (state: LangGraphState) =>
      await this.routeFromNode(NODES.ASK_ANOTHER, state)
    );

    workflow.addEdge(NODES.GOODBYE, NODES.HANGUP);
    workflow.addEdge(NODES.HANGUP, END);
    workflow.addEdge(NODES.ERROR, END);

    // Compile with checkpointer for persistence
    return workflow.compile({ checkpointer: this.checkpointer });
  }

  /**
   * Wrap a simple node function (no MCP needed)
   */
  private wrapNode(nodeFunc: (state: OriginalAgentState) => Promise<Partial<OriginalAgentState>>, nodeName: NodeName) {
    return async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
      console.log(`\n[LangGraph] 🎯 Executing: ${nodeName}`);
      this.logFlagState(state.progress_flags || {}, 'Before execution');

      // Convert LangGraph state to our original state format
      const originalState = this.toOriginalState(state);

      // Execute the node - node decides internally if it needs to act
      const result = await nodeFunc(originalState);

      // Convert result back to LangGraph format
      const update = this.toLangGraphUpdate(result);

      if (update.progress_flags) {
        this.logFlagState(update.progress_flags, 'After execution (update)');
      }

      return update;
    };
  }

  /**
   * Wrap node that needs MCP and authToken
   */
  private wrapNodeWithMCP(
    nodeFunc: (
      state: OriginalAgentState,
      mcp: MCPAdapterService,
      token: string
    ) => Promise<Partial<OriginalAgentState>>,
    nodeName: NodeName
  ) {
    return async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
      console.log(`\n[LangGraph] 🎯 Executing: ${nodeName}`);
      this.logFlagState(state.progress_flags || {}, 'Before execution');

      const originalState = this.toOriginalState(state);
      const result = await nodeFunc(originalState, this.mcpAdapter, state._authToken || '');

      const update = this.toLangGraphUpdate(result);

      if (update.progress_flags) {
        this.logFlagState(update.progress_flags, 'After execution (update)');
      }

      return update;
    };
  }

  /**
   * Wrap node that only needs MCP (not authToken)
   */
  private wrapNodeWithMCPOnly(
    nodeFunc: (state: OriginalAgentState, mcp: MCPAdapterService) => Promise<Partial<OriginalAgentState>>,
    nodeName: NodeName
  ) {
    return async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
      console.log(`\n[LangGraph] 🎯 Executing: ${nodeName}`);
      this.logFlagState(state.progress_flags || {}, 'Before execution');

      const originalState = this.toOriginalState(state);
      const result = await nodeFunc(originalState, this.mcpAdapter);

      const update = this.toLangGraphUpdate(result);

      if (update.progress_flags) {
        this.logFlagState(update.progress_flags, 'After execution (update)');
      }

      return update;
    };
  }

  /**
   * Wrap hangup node (has optional chatSessionId)
   */
  private wrapNodeForHangup(
    nodeFunc: (
      state: OriginalAgentState,
      mcp?: MCPAdapterService,
      chatSessionId?: string
    ) => Promise<Partial<OriginalAgentState>>,
    nodeName: NodeName
  ) {
    return async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
      console.log(`\n[LangGraph] 🎯 Executing: ${nodeName}`);

      const originalState = this.toOriginalState(state);
      const result = await nodeFunc(originalState, this.mcpAdapter, undefined);

      return this.toLangGraphUpdate(result);
    };
  }

  /**
   * Wrap error node (has optional error message)
   */
  private wrapNodeForError(
    nodeFunc: (state: OriginalAgentState, errorMsg?: string) => Promise<Partial<OriginalAgentState>>,
    nodeName: NodeName
  ) {
    return async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
      console.log(`\n[LangGraph] ❌ Executing: ${nodeName}`);

      const originalState = this.toOriginalState(state);
      const result = await nodeFunc(originalState);

      return this.toLangGraphUpdate(result);
    };
  }

  /**
   * Convert LangGraph state to original AgentState format
   */
  private toOriginalState(state: LangGraphState): OriginalAgentState {
    return {
      messages: state.messages.map((msg) => ({
        role: msg._getType() === 'human' ? 'user' as const : 'assistant' as const,
        content: msg.content.toString(),
      })),
      context: state.context || {},
      progress_flags: state.progress_flags || {},
      customer_profile: state.customer_profile || {},
      proposed_actions: state.proposed_actions || [],
      available_actions: state.available_actions || [],
      approved_actions: state.approved_actions || [],
      executed_actions: state.executed_actions || [],
      current_node: state.current_node,
      conversation_ended: state.conversation_ended,
      completed: state.completed,
      end_reason: state.end_reason,
    };
  }

  /**
   * Convert node result to LangGraph update format
   */
  private toLangGraphUpdate(
    result: Partial<OriginalAgentState>
  ): Partial<LangGraphState> {
    const update: Partial<LangGraphState> = {};

    if (result.messages) {
      update.messages = result.messages.map((msg) =>
        msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
      );
    }

    if (result.context) {
      update.context = result.context;
    }

    if (result.progress_flags) {
      update.progress_flags = result.progress_flags;
    }

    if (result.customer_profile) {
      update.customer_profile = result.customer_profile;
    }

    if (result.proposed_actions) {
      update.proposed_actions = result.proposed_actions;
    }

    if (result.available_actions) {
      update.available_actions = result.available_actions;
    }

    if (result.approved_actions) {
      update.approved_actions = result.approved_actions;
    }

    if (result.executed_actions) {
      update.executed_actions = result.executed_actions;
    }

    if (result.current_node) {
      update.current_node = result.current_node;
    }

    if (result.conversation_ended !== undefined) {
      update.conversation_ended = result.conversation_ended;
    }

    if (result.completed !== undefined) {
      update.completed = result.completed;
    }

    if (result.end_reason) {
      update.end_reason = result.end_reason;
    }

    return update;
  }

  /**
   * Determine next node (conditional routing logic with LLM-based navigation)
   */
  private async routeFromNode(currentNode: NodeName, state: LangGraphState): Promise<NodeName> {
    console.log(`\n[LangGraph] 🔀 Routing from: ${currentNode}`);
    this.logFlagState(state.progress_flags || {}, 'Current state');

    // Get last user message for context
    const lastMessage = state.messages[state.messages.length - 1];
    const lastUserMessage = lastMessage?._getType() === 'human' ? lastMessage.content.toString() : undefined;

    // Use Navigation Agent for intelligent routing decisions
    const navAnalysis = await this.navigationAgent.analyzeNavigation(
      currentNode,
      state,
      lastUserMessage
    );

    // Handle issue change
    if (navAnalysis.issue_changed) {
      console.log(`[LangGraph] 🔄 LLM detected issue change: ${navAnalysis.issue_change_reason}`);
      console.log(`[LangGraph] 🔄 Resetting flags: ${navAnalysis.flags_to_reset.join(', ')}`);

      // Reset flags as determined by LLM
      this.resetFlagsFromList(navAnalysis.flags_to_reset, state, navAnalysis.preserve_customer_data);

      return NODES.IDENTIFY;
    }

    // Handle data update request
    if (navAnalysis.data_update_requested && navAnalysis.data_field) {
      console.log(`[LangGraph] 🔄 LLM detected data update request for: ${navAnalysis.data_field}`);
      console.log(`[LangGraph] 🔄 Resetting flags: ${navAnalysis.flags_to_reset.join(', ')}`);

      // Reset specific data flag
      this.resetFlagsFromList(navAnalysis.flags_to_reset, state, true);

      return NODES.GATHER;
    }

    // Normal flow routing
    switch (currentNode) {
      case NODES.ASK_NEED:
        // Check if we have a user message after asking
        const lastMsgAfterAsk = state.messages[state.messages.length - 1];
        const hasUserResponse = lastMsgAfterAsk?._getType() === 'human';

        if (!hasUserResponse) {
          // Just asked the question, wait for user response
          return END;
        }
        // User responded, proceed to identify issue
        return NODES.IDENTIFY;

      case NODES.IDENTIFY:
        // After identifying issue, check progress flag using bridge
        const issueIdentified = this.stateBridge.isFlagSet(
          state.progress_flags || {},
          'issue_identified'
        );
        if (!issueIdentified) {
          // Issue not identified yet, wait for user input
          return END;
        }
        return NODES.EMPATHIZE;

      case NODES.GATHER:
        // Use progress flags via bridge instead of checking context directly
        const phoneCollected = this.stateBridge.isFlagSet(
          state.progress_flags || {},
          'phone_collected'
        );
        const nameCollected = this.stateBridge.isFlagSet(
          state.progress_flags || {},
          'name_collected'
        );

        if (!phoneCollected || !nameCollected) {
          return END; // Stop and wait for user input
        }
        return NODES.CHECK;

      case NODES.COMMUNICATE_PLAN:
        return NODES.EXECUTE;

      case NODES.ASK_ANOTHER:
        // Check if customer wants to do something else
        const lastMessage = state.messages[state.messages.length - 1];
        if (!lastMessage || lastMessage._getType() !== 'human') {
          return END; // Wait for user response
        }

        const userMessage = lastMessage.content.toString().toLowerCase();
        const yesIndicators = /yes|yeah|yep|sure|actually|i need|help me|can you|could you/i;
        const noIndicators = /no|nope|nah|that's all|all set|nothing|i'm good|thanks|goodbye/i;

        if (noIndicators.test(userMessage)) {
          console.log(`[LangGraph] 🔄 Customer declined, routing to GOODBYE`);
          return NODES.GOODBYE;
        }

        if (yesIndicators.test(userMessage)) {
          console.log(`[LangGraph] 🔄 Customer has another request, routing to IDENTIFY`);
          // Reset steps from IDENTIFY onwards, but preserve customer data
          this.resetStepsFrom('III_identify_issue', state, true);
          return NODES.IDENTIFY;
        }

        // Default to GOODBYE if unclear
        return NODES.GOODBYE;

      default:
        return NODES.GOODBYE;
    }
  }

  /**
   * Reset specific flags from a list (determined by Navigation Agent LLM)
   */
  private resetFlagsFromList(
    flagsToReset: string[],
    state: LangGraphState,
    preserveCustomerData: boolean = true
  ): void {
    const progressFlags = state.progress_flags || {};

    console.log(`[LangGraph] 🔄 Resetting ${flagsToReset.length} flags (LLM-determined)`);

    // Reset each flag
    for (const flagName of flagsToReset) {
      progressFlags[flagName] = false;
    }

    // Update state.progress_flags directly (mutable update for LangGraph)
    Object.assign(state.progress_flags || {}, progressFlags);

    // Clear issue-related context if needed
    if (flagsToReset.includes('issue_identified')) {
      const context = state.context || {};
      if (!preserveCustomerData) {
        context.customers_main_ask = '';
        context.matching_service_catalog = '';
        context.related_entities = [];
        context.next_steps_plan = [];
      } else {
        // Only clear issue, keep customer data
        context.customers_main_ask = '';
        context.matching_service_catalog = '';
        context.next_steps_plan = [];
      }
    }

    console.log(`[LangGraph] 🔄 Reset complete. Flags reset: ${flagsToReset.join(', ')}`);
  }

  /**
   * Reset steps from a given point onwards
   * IMPORTANT: Also resets progress_flags to allow nodes to re-execute
   */
  private resetStepsFrom(
    startStep: keyof StepCompletionTracker,
    state: LangGraphState,
    preserveCustomerData: boolean = true
  ): void {
    const context = state.context || {};
    const stepsCompleted = context.steps_completed || {};
    const progressFlags = state.progress_flags || {};

    const stepOrder: (keyof StepCompletionTracker)[] = [
      'I_greet',
      'II_ask_need',
      'III_identify_issue',
      'IV_empathize',
      'V_build_rapport',
      'VI_gather_data',
      'VII_check_customer',
      'VIII_plan_actions',
      'IX_communicate_plan',
      'X_execute_plan',
      'XI_communicate_execution',
    ];

    // Map steps to progress flag names
    const stepToFlagMap: Record<string, string> = {
      'I_greet': 'greeted',
      'II_ask_need': 'asked_need',
      'III_identify_issue': 'issue_identified',
      'IV_empathize': 'empathized',
      'V_build_rapport': 'rapport_built',
      'VI_gather_data': 'phone_collected,name_collected', // Multiple flags
      'VII_check_customer': 'customer_checked',
      'VIII_plan_actions': 'plan_created',
      'IX_communicate_plan': 'plan_communicated',
      'X_execute_plan': 'plan_executed',
      'XI_communicate_execution': 'execution_communicated',
    };

    const startIndex = stepOrder.indexOf(startStep);
    if (startIndex === -1) return;

    // Reset both steps_completed and progress_flags
    for (let i = startIndex; i < stepOrder.length; i++) {
      const step = stepOrder[i];

      // Reset steps_completed
      stepsCompleted[step] = false;

      // Reset corresponding progress_flags
      const flagNames = stepToFlagMap[step];
      if (flagNames) {
        flagNames.split(',').forEach(flagName => {
          progressFlags[flagName.trim()] = false;
        });
      }
    }

    // Update state.progress_flags directly (mutable update for LangGraph)
    Object.assign(state.progress_flags || {}, progressFlags);

    if (!preserveCustomerData || startStep === 'III_identify_issue') {
      context.customers_main_ask = '';
      context.matching_service_catalog = '';
      context.related_entities = [];
      context.next_steps_plan = [];
    }

    console.log(
      `[LangGraph] 🔄 Reset steps from ${startStep} onwards (preserveCustomerData: ${preserveCustomerData})`
    );
    console.log(`[LangGraph] 🔄 Reset progress flags:`,
      Object.keys(progressFlags).filter(k => progressFlags[k] === false).join(', ')
    );
  }

  /**
   * Initialize new conversation state
   */
  createInitialState(): Partial<LangGraphState> {
    // Load who_are_you from DAG config
    let whoAreYou = 'You are a polite customer service agent who is assisting a customer'; // Default fallback
    try {
      const dagLoader = getDAGLoader();
      const systemConfig = dagLoader.getSystemConfig();
      whoAreYou = systemConfig.default_context_values.who_are_you;
      console.log(`[LangGraph] 📝 Loaded agent identity from DAG config: "${whoAreYou}"`);
    } catch (error) {
      console.warn(`[LangGraph] ⚠️  Could not load system config from DAG, using default`);
    }

    return {
      messages: [],
      context: {
        who_are_you: whoAreYou,
        related_entities: [],
        next_steps_plan: [],
        conversation_stage: 'greeting',
        steps_completed: {
          I_greet: false,
          II_ask_need: false,
          III_identify_issue: false,
          IV_empathize: false,
          V_build_rapport: false,
          VI_gather_data: false,
          VII_check_customer: false,
          VIII_plan_actions: false,
          IX_communicate_plan: false,
          X_execute_plan: false,
          XI_communicate_execution: false,
        },
      },
      progress_flags: {
        greeted: false,
        asked_need: false,
        issue_identified: false,
        empathized: false,
        rapport_built: false,
        phone_collected: false,
        name_collected: false,
        email_collected: false,
        address_collected: false,
        customer_checked: false,
        plan_created: false,
      },
      customer_profile: {},
      proposed_actions: [],
      available_actions: [],
      approved_actions: [],
      executed_actions: [],
      current_node: NODES.GREET,
      conversation_ended: false,
      completed: false,
    };
  }

  /**
   * Process a message through the LangGraph
   */
  async processMessage(
    sessionId: string,
    userMessage: string,
    authToken: string,
    existingState?: Partial<LangGraphState>
  ): Promise<LangGraphState> {
    // Ensure service is fully initialized
    await this.ensureInitialized();

    console.log(`\n[LangGraph] ====== Processing Message (14-Step Flow) ======`);
    console.log(`[LangGraph] Session: ${sessionId}`);
    console.log(`[LangGraph] User message: "${userMessage}"`);

    // Check if session exists in checkpointer
    const hasExistingCheckpoint = existingState !== undefined;

    let inputState: Partial<LangGraphState>;

    if (hasExistingCheckpoint) {
      // Resuming session: ONLY pass new message + non-serializable fields
      // Checkpointer automatically loads all other state
      console.log(`[LangGraph] 🔄 Resuming session - checkpointer will load previous state`);
      inputState = {
        _mcpAdapter: this.mcpAdapter,
        _authToken: authToken,
      };

      // Only add message if not [CALL_STARTED]
      if (userMessage !== '[CALL_STARTED]') {
        inputState.messages = [new HumanMessage(userMessage)];
      }
    } else {
      // New session: pass full initial state
      console.log(`[LangGraph] 🆕 New session - creating initial state`);
      inputState = this.createInitialState();

      // Add user message for new session
      if (userMessage !== '[CALL_STARTED]') {
        inputState.messages = [
          ...(inputState.messages || []),
          new HumanMessage(userMessage),
        ];
      }

      // Add MCP adapter and auth token (these won't be serialized)
      inputState._mcpAdapter = this.mcpAdapter;
      inputState._authToken = authToken;
    }

    // Invoke the graph
    // - For new sessions: uses inputState as initial state
    // - For existing sessions: checkpointer loads state, merges inputState updates
    const result = await this.graph.invoke(inputState, {
      configurable: { thread_id: sessionId },
    });

    console.log(`[LangGraph] ====== Processing Complete ======\n`);

    return result;
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string): Promise<LangGraphState | null> {
    try {
      // Ensure service is fully initialized
      await this.ensureInitialized();

      const state = await this.graph.getState({
        configurable: { thread_id: sessionId },
      });
      console.log(`[LangGraph] 📖 Retrieved state for session ${sessionId}:`, {
        hasValues: !!state.values,
        messages: state.values?.messages?.length || 0,
        currentNode: state.values?.current_node,
      });
      return state.values as LangGraphState;
    } catch (error) {
      console.error(`[LangGraph] Error getting conversation history:`, error);
      return null;
    }
  }

  /**
   * Log current flag state for debugging
   */
  private logFlagState(flags: Record<string, boolean>, context: string): void {
    const setFlags = Object.entries(flags)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => key)
      .join(', ');

    console.log(`[LangGraph] 🏁 Flags (${context}): ${setFlags || 'none set'}`);
  }

  /**
   * Get the graph definition (for visualization)
   */
  getGraphDefinition() {
    return {
      nodes: [
        'I. Greet Customer',
        'II. Ask About Need',
        'III. Identify Issue',
        'IV. Empathize',
        'V. Build Rapport',
        'VI. Gather Customer Data',
        'VII. Check Existing Customer',
        'VIII. Plan Actions',
        'IX. Communicate Plan',
        'X. Execute Plan',
        'XI. Communicate Execution',
        'XIb. Ask Another Request',
        'XII. Goodbye',
        'XIII. Hangup',
      ],
      flow: 'Sequential with conditional loops and intelligent routing (LangGraph)',
    };
  }
}

/**
 * Singleton instance
 */
let instance: LangGraphStateGraphService | null = null;

export function getLangGraphStateGraphService(
  mcpAdapter: MCPAdapterService
): LangGraphStateGraphService {
  if (!instance) {
    instance = new LangGraphStateGraphService(mcpAdapter);
  }
  return instance;
}
