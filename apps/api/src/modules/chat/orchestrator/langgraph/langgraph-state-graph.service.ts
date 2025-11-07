/**
 * LangGraph-based State Graph Orchestrator
 * Full implementation with all features preserved
 * @module orchestrator/langgraph/langgraph-state-graph
 */

import { StateGraph, Annotation, START, END, MemorySaver } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/dist/messages/index.js';
import type { CustomerContext, StepCompletionTracker } from './prompts.config.js';
import type { MCPAdapterService } from '../../mcp-adapter.service.js';
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
  private checkpointer: MemorySaver;

  constructor(mcpAdapter: MCPAdapterService) {
    this.mcpAdapter = mcpAdapter;
    this.checkpointer = new MemorySaver();
    this.graph = this.buildGraph();
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

    // Define edges with conditional logic
    workflow.addEdge(NODES.GREET, NODES.ASK_NEED);

    workflow.addConditionalEdges(NODES.ASK_NEED, (state: LangGraphState) =>
      this.routeFromNode(NODES.ASK_NEED, state)
    );

    workflow.addConditionalEdges(NODES.IDENTIFY, (state: LangGraphState) =>
      this.routeFromNode(NODES.IDENTIFY, state)
    );

    workflow.addEdge(NODES.EMPATHIZE, NODES.RAPPORT);
    workflow.addEdge(NODES.RAPPORT, NODES.GATHER);

    workflow.addConditionalEdges(NODES.GATHER, (state: LangGraphState) =>
      this.routeFromNode(NODES.GATHER, state)
    );

    workflow.addEdge(NODES.CHECK, NODES.PLAN);
    workflow.addEdge(NODES.PLAN, NODES.COMMUNICATE_PLAN);

    workflow.addConditionalEdges(NODES.COMMUNICATE_PLAN, (state: LangGraphState) =>
      this.routeFromNode(NODES.COMMUNICATE_PLAN, state)
    );

    workflow.addEdge(NODES.EXECUTE, NODES.COMMUNICATE_EXEC);
    workflow.addEdge(NODES.COMMUNICATE_EXEC, NODES.ASK_ANOTHER);

    workflow.addConditionalEdges(NODES.ASK_ANOTHER, (state: LangGraphState) =>
      this.routeFromNode(NODES.ASK_ANOTHER, state)
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

      // Check if should skip
      if (this.shouldSkipStep(nodeName, state)) {
        console.log(`[LangGraph] ⏭️  Skipping ${nodeName} (already completed)`);
        return {};
      }

      // Convert LangGraph state to our original state format
      const originalState = this.toOriginalState(state);

      // Execute the node
      const result = await nodeFunc(originalState);

      // Mark as completed
      this.markStepCompleted(nodeName, state);

      // Convert result back to LangGraph format
      return this.toLangGraphUpdate(result);
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

      if (this.shouldSkipStep(nodeName, state)) {
        console.log(`[LangGraph] ⏭️  Skipping ${nodeName} (already completed)`);
        return {};
      }

      const originalState = this.toOriginalState(state);
      const result = await nodeFunc(originalState, this.mcpAdapter, state._authToken || '');

      this.markStepCompleted(nodeName, state);

      return this.toLangGraphUpdate(result);
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

      if (this.shouldSkipStep(nodeName, state)) {
        console.log(`[LangGraph] ⏭️  Skipping ${nodeName} (already completed)`);
        return {};
      }

      const originalState = this.toOriginalState(state);
      const result = await nodeFunc(originalState, this.mcpAdapter);

      this.markStepCompleted(nodeName, state);

      return this.toLangGraphUpdate(result);
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
   * Check if a step should be skipped (already completed with valid data)
   */
  private shouldSkipStep(nodeName: NodeName, state: LangGraphState): boolean {
    const context = state.context || {};
    const stepsCompleted = context.steps_completed || {};

    const stepMap: Record<string, keyof StepCompletionTracker> = {
      [NODES.GREET]: 'I_greet',
      [NODES.ASK_NEED]: 'II_ask_need',
      [NODES.IDENTIFY]: 'III_identify_issue',
      [NODES.EMPATHIZE]: 'IV_empathize',
      [NODES.RAPPORT]: 'V_build_rapport',
      [NODES.GATHER]: 'VI_gather_data',
      [NODES.CHECK]: 'VII_check_customer',
      [NODES.PLAN]: 'VIII_plan_actions',
      [NODES.COMMUNICATE_PLAN]: 'IX_communicate_plan',
      [NODES.EXECUTE]: 'X_execute_plan',
      [NODES.COMMUNICATE_EXEC]: 'XI_communicate_execution',
    };

    const stepKey = stepMap[nodeName];
    if (!stepKey) return false;

    const isCompleted = stepsCompleted[stepKey] === true;

    // Additional validation for GATHER step
    if (nodeName === NODES.GATHER && isCompleted) {
      const hasPhone = !!context.customer_phone_number;
      const hasName = !!context.customer_name;
      if (!hasPhone || !hasName) {
        console.log(`[LangGraph] ⚠️  GATHER step marked complete but missing data, re-executing`);
        return false;
      }
    }

    return isCompleted;
  }

  /**
   * Mark a step as completed
   */
  private markStepCompleted(nodeName: NodeName, state: LangGraphState): void {
    const context = state.context || {};
    const stepsCompleted = context.steps_completed || {};

    const stepMap: Record<string, keyof StepCompletionTracker> = {
      [NODES.GREET]: 'I_greet',
      [NODES.ASK_NEED]: 'II_ask_need',
      [NODES.IDENTIFY]: 'III_identify_issue',
      [NODES.EMPATHIZE]: 'IV_empathize',
      [NODES.RAPPORT]: 'V_build_rapport',
      [NODES.GATHER]: 'VI_gather_data',
      [NODES.CHECK]: 'VII_check_customer',
      [NODES.PLAN]: 'VIII_plan_actions',
      [NODES.COMMUNICATE_PLAN]: 'IX_communicate_plan',
      [NODES.EXECUTE]: 'X_execute_plan',
      [NODES.COMMUNICATE_EXEC]: 'XI_communicate_execution',
    };

    const stepKey = stepMap[nodeName];
    if (stepKey) {
      stepsCompleted[stepKey] = true;
      console.log(`[LangGraph] ✅ Marked ${nodeName} as completed`);
    }
  }

  /**
   * Determine next node (conditional routing logic)
   */
  private routeFromNode(currentNode: NodeName, state: LangGraphState): NodeName {
    // Check for issue change
    if (this.detectIssueChange(state)) {
      console.log(`[LangGraph] 🔄 Issue change detected, routing to IDENTIFY`);
      this.resetStepsFrom('III_identify_issue', state, true);
      return NODES.IDENTIFY;
    }

    // Check for data update request
    const dataField = this.detectDataUpdateRequest(state);
    if (dataField) {
      console.log(`[LangGraph] 🔄 Data update detected (${dataField}), routing to GATHER`);
      if (state.context?.steps_completed) {
        state.context.steps_completed.VI_gather_data = false;
      }
      return NODES.GATHER;
    }

    // Normal flow routing
    switch (currentNode) {
      case NODES.ASK_NEED:
        return NODES.IDENTIFY;

      case NODES.IDENTIFY:
        return NODES.EMPATHIZE;

      case NODES.GATHER:
        const context = state.context || {};
        const hasPhone = !!context.customer_phone_number;
        const hasName = !!context.customer_name;

        if (!hasPhone || !hasName) {
          return NODES.GATHER; // Stay and wait for more data
        }
        return NODES.CHECK;

      case NODES.COMMUNICATE_PLAN:
        return NODES.EXECUTE;

      case NODES.ASK_ANOTHER:
        // Check if customer wants to do something else
        const lastMessage = state.messages[state.messages.length - 1];
        if (!lastMessage || lastMessage._getType() !== 'human') {
          return NODES.GOODBYE;
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
   * Detect if customer is changing their issue
   */
  private detectIssueChange(state: LangGraphState): boolean {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage || lastMessage._getType() !== 'human') return false;

    const userMessage = lastMessage.content.toString();
    const changeIndicators = [
      /actually/i,
      /instead/i,
      /wait/i,
      /change.*request/i,
      /different.*issue/i,
      /new.*problem/i,
      /forget.*that/i,
      /never.*mind/i,
      /i meant/i,
      /let me change/i,
    ];

    for (const pattern of changeIndicators) {
      if (pattern.test(userMessage)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect if customer wants to update specific data
   */
  private detectDataUpdateRequest(state: LangGraphState): string | null {
    const lastMessage = state.messages[state.messages.length - 1];
    if (!lastMessage || lastMessage._getType() !== 'human') return null;

    const userMessage = lastMessage.content.toString().toLowerCase();

    if (userMessage.match(/change.*phone|update.*phone|new phone|different phone/)) {
      return 'customer_phone_number';
    }
    if (userMessage.match(/change.*name|update.*name|my name is actually/)) {
      return 'customer_name';
    }
    if (userMessage.match(/change.*email|update.*email|new email|different email/)) {
      return 'customer_email';
    }
    if (userMessage.match(/change.*address|update.*address|new address|different address/)) {
      return 'customer_address';
    }

    return null;
  }

  /**
   * Reset steps from a given point onwards
   */
  private resetStepsFrom(
    startStep: keyof StepCompletionTracker,
    state: LangGraphState,
    preserveCustomerData: boolean = true
  ): void {
    const context = state.context || {};
    const stepsCompleted = context.steps_completed || {};

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

    const startIndex = stepOrder.indexOf(startStep);
    if (startIndex === -1) return;

    for (let i = startIndex; i < stepOrder.length; i++) {
      stepsCompleted[stepOrder[i]] = false;
    }

    if (!preserveCustomerData || startStep === 'III_identify_issue') {
      context.customers_main_ask = '';
      context.matching_service_catalog = '';
      context.related_entities = [];
      context.next_steps_plan = [];
    }

    console.log(
      `[LangGraph] 🔄 Reset steps from ${startStep} onwards (preserveCustomerData: ${preserveCustomerData})`
    );
  }

  /**
   * Initialize new conversation state
   */
  createInitialState(): Partial<LangGraphState> {
    return {
      messages: [],
      context: {
        who_are_you: 'You are a polite customer service agent who is assisting a customer',
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
    console.log(`\n[LangGraph] ====== Processing Message (14-Step Flow) ======`);
    console.log(`[LangGraph] Session: ${sessionId}`);
    console.log(`[LangGraph] User message: "${userMessage}"`);

    const inputState: Partial<LangGraphState> = existingState || this.createInitialState();

    // Add user message
    if (userMessage !== '[CALL_STARTED]') {
      inputState.messages = [
        ...(inputState.messages || []),
        new HumanMessage(userMessage),
      ];
    }

    // Add MCP adapter and auth token (these won't be serialized)
    inputState._mcpAdapter = this.mcpAdapter;
    inputState._authToken = authToken;

    // Invoke the graph
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
      const state = await this.graph.getState({
        configurable: { thread_id: sessionId },
      });
      return state.values as LangGraphState;
    } catch (error) {
      console.error(`[LangGraph] Error getting conversation history:`, error);
      return null;
    }
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
