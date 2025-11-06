/**
 * Agent Coordinator Service
 * Orchestrates Planner, Worker, Critic, and Summarizer agents
 * Implements multi-agent workflow with circuit breaker and retry logic
 * @module orchestrator/agents/agent-coordinator
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { WorkflowState, getStateMachineService } from '../state/state-machine.service.js';
import { getCircuitBreakerService } from '../state/circuit-breaker.service.js';
import { StateManager } from '../state/state-manager.service.js';
import { PlannerAgent } from './planner.agent.js';
import { WorkerAgent } from './worker.agent.js';
import { SummarizerAgent } from './summarizer.agent.js';
import { CriticAgent } from './critic.agent.js';
import { MCPAdapterService } from '../../mcp-adapter.service.js';

/**
 * Coordinator Result
 */
export interface CoordinatorResult {
  naturalResponse: string;
  nextState: WorkflowState;
  requiresUserInput: boolean;
  completed: boolean;
  conversationEnded: boolean;
  endReason?: string;
  variables: Record<string, any>;
}

/**
 * Agent Coordinator
 * Central orchestrator for multi-agent workflow
 */
export class AgentCoordinatorService {
  private stateManager: StateManager;
  private stateMachine = getStateMachineService();
  private circuitBreaker;

  private plannerAgent: PlannerAgent;
  private workerAgent: WorkerAgent;
  private summarizerAgent: SummarizerAgent;
  private criticAgent: CriticAgent;
  private mcpAdapter: MCPAdapterService;

  // Conversation history for LLM context
  private conversationHistory: Map<string, ChatCompletionMessageParam[]> = new Map();

  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  constructor(stateManager: StateManager, mcpAdapter: MCPAdapterService) {
    this.stateManager = stateManager;
    this.mcpAdapter = mcpAdapter;
    this.circuitBreaker = getCircuitBreakerService(stateManager);

    // Initialize agents
    this.plannerAgent = new PlannerAgent(stateManager);
    this.workerAgent = new WorkerAgent();
    this.summarizerAgent = new SummarizerAgent(stateManager);
    this.criticAgent = new CriticAgent();
  }

  /**
   * Process a user message through the multi-agent workflow
   */
  async processMessage(args: {
    sessionId: string;
    currentState: WorkflowState;
    userMessage: string;
    variables: Record<string, any>;
    authToken?: string;
    chatSessionId?: string;
  }): Promise<CoordinatorResult> {
    const startTime = Date.now();

    console.log(`\n[AgentCoordinator] ====== Processing Message ======`);
    console.log(`[AgentCoordinator] Session: ${args.sessionId}`);
    console.log(`[AgentCoordinator] State: ${args.currentState}`);
    console.log(`[AgentCoordinator] Message: "${args.userMessage}"`);

    try {
      // Step 1: Critic validates input
      console.log(`\n[AgentCoordinator] Step 1: Critic validates input`);
      const validation = await this.criticAgent.validateInputData({
        sessionId: args.sessionId,
        currentState: args.currentState,
        variables: args.variables,
      });

      if (!validation.isValid) {
        console.log(`[AgentCoordinator] ❌ Validation failed:`, validation.errors);
        return {
          naturalResponse: `I need to verify some information: ${validation.errors.join(', ')}`,
          nextState: args.currentState, // Stay in same state
          requiresUserInput: true,
          completed: false,
          conversationEnded: false,
          variables: args.variables,
        };
      }

      // Step 2: Summarizer tracks progress (every 5 messages or state change)
      const conversationHistory = this.getConversationHistory(args.sessionId);
      conversationHistory.push({ role: 'user', content: args.userMessage });

      const previousSummary = await this.stateManager.getLatestSummary(args.sessionId);
      const shouldSummarize = this.summarizerAgent.shouldSummarize({
        messageCount: conversationHistory.length,
        lastSummaryMessageCount: previousSummary?.message_count || 0,
        stateChanged: false, // Will update after transition
      });

      let summary;
      if (shouldSummarize) {
        console.log(`\n[AgentCoordinator] Step 2: Summarizer generates progress summary`);
        summary = await this.summarizerAgent.summarize({
          sessionId: args.sessionId,
          currentState: args.currentState,
          variables: args.variables,
          conversationHistory,
          previousSummary: previousSummary?.summary_text,
        });
        console.log(`[AgentCoordinator] Progress: ${summary.progressPercentage}% complete`);
      }

      // Step 3: Planner decides next action
      console.log(`\n[AgentCoordinator] Step 3: Planner decides next action`);

      // Check if planner circuit is open
      const plannerCircuitOpen = await this.circuitBreaker.isOpen(args.sessionId, 'planner');
      if (plannerCircuitOpen) {
        console.log(`[AgentCoordinator] ⚠️ Planner circuit is OPEN - escalating to fallback`);
        return this.handleCircuitOpen(args);
      }

      let plannerDecision;
      try {
        plannerDecision = await this.plannerAgent.plan({
          sessionId: args.sessionId,
          currentState: args.currentState,
          variables: args.variables,
          userMessage: args.userMessage,
          conversationSummary: summary?.fullSummary,
        });

        await this.circuitBreaker.recordSuccess(args.sessionId, 'planner');
        console.log(`[AgentCoordinator] ✅ Planner decision: ${plannerDecision.nextState} (${plannerDecision.confidence}% confidence)`);
        console.log(`[AgentCoordinator] Reasoning: ${plannerDecision.reasoning}`);
      } catch (error: any) {
        console.error(`[AgentCoordinator] ❌ Planner failed:`, error.message);
        await this.circuitBreaker.recordFailure(args.sessionId, 'planner', error);

        // Use fallback state machine logic
        plannerDecision = {
          nextState: this.stateMachine.getNextState({
            currentState: args.currentState,
            hasCustomer: !!args.variables.customer_id,
            hasService: !!args.variables.service_category,
            hasPhone: !!args.variables.customer_phone,
            hasName: !!args.variables.customer_name,
            hasAddress: !!args.variables.customer_address,
            hasAvailability: !!args.variables.desired_date,
            taskCreated: !!args.variables.task_id,
            bookingCreated: !!args.variables.booking_id,
          }),
          action: 'continue',
          reasoning: 'Fallback to state machine',
          requiredInfo: [],
          missingInfo: [],
          requiresUserInput: true,
          completed: false,
          confidence: 50,
        };
      }

      // Step 4: Worker executes actions for the next state
      console.log(`\n[AgentCoordinator] Step 4: Worker executes actions`);

      const workerResult = await this.executeWorkerActions({
        sessionId: args.sessionId,
        nextState: plannerDecision.nextState,
        currentState: args.currentState,
        variables: args.variables,
        userMessage: args.userMessage,
        authToken: args.authToken,
      });

      // Update variables with worker results
      const updatedVariables = {
        ...args.variables,
        ...workerResult.updates,
      };

      // Step 5: Validate transition and update state
      console.log(`\n[AgentCoordinator] Step 5: Validating state transition`);
      const isValidTransition = this.stateMachine.isValidTransition(
        args.currentState,
        plannerDecision.nextState
      );

      if (!isValidTransition) {
        console.log(`[AgentCoordinator] ⚠️ Invalid transition blocked: ${args.currentState} → ${plannerDecision.nextState}`);
        // Stay in current state
        return {
          naturalResponse: workerResult.response,
          nextState: args.currentState,
          requiresUserInput: true,
          completed: false,
          conversationEnded: false,
          variables: updatedVariables,
        };
      }

      const nextState = this.stateMachine.transition(args.currentState, plannerDecision.nextState);
      console.log(`[AgentCoordinator] ✅ Transitioned: ${args.currentState} → ${nextState}`);

      // Check if workflow is complete
      const isComplete = this.stateMachine.isTerminalState(nextState);
      const conversationEnded = nextState === WorkflowState.DONE || nextState === WorkflowState.FALLBACK;

      // Add assistant response to history
      conversationHistory.push({ role: 'assistant', content: workerResult.response });
      this.updateConversationHistory(args.sessionId, conversationHistory);

      // Log coordinator execution
      await this.stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'orchestrator',
        agent_action: 'coordinate_agents',
        node_context: nextState,
        input_data: {
          from_state: args.currentState,
          to_state: nextState,
        },
        output_data: {
          decision: plannerDecision.action,
          requires_input: plannerDecision.requiresUserInput,
          completed: isComplete,
        },
        success: true,
        natural_response: workerResult.response,
        duration_ms: Date.now() - startTime,
      });

      console.log(`[AgentCoordinator] ====== Processing Complete ======\n`);

      return {
        naturalResponse: workerResult.response,
        nextState,
        requiresUserInput: plannerDecision.requiresUserInput,
        completed: isComplete,
        conversationEnded,
        endReason: conversationEnded ? (nextState === WorkflowState.DONE ? 'completed' : 'fallback') : undefined,
        variables: updatedVariables,
      };
    } catch (error: any) {
      console.error(`[AgentCoordinator] ❌ Fatal error:`, error);

      // Log error
      await this.stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'orchestrator',
        agent_action: 'coordinate_agents',
        node_context: args.currentState,
        success: false,
        error_message: error.message,
        duration_ms: Date.now() - startTime,
      });

      // Transition to error state
      return {
        naturalResponse: "I'm experiencing technical difficulties. Let me connect you with a specialist who can help.",
        nextState: WorkflowState.ERROR,
        requiresUserInput: false,
        completed: false,
        conversationEnded: true,
        endReason: 'error',
        variables: args.variables,
      };
    }
  }

  /**
   * Execute worker actions based on workflow state
   */
  private async executeWorkerActions(args: {
    sessionId: string;
    nextState: WorkflowState;
    currentState: WorkflowState;
    variables: Record<string, any>;
    userMessage: string;
    authToken?: string;
  }): Promise<{ response: string; updates: Record<string, any> }> {
    const updates: Record<string, any> = {};

    switch (args.nextState) {
      case WorkflowState.GREETING:
        return {
          response: "Hello! I'm here to help you schedule a service appointment. What can I help you with today?",
          updates,
        };

      case WorkflowState.ASK_PROBLEM:
        return {
          response: "I'd be happy to help! Could you tell me what service you need or what issue you're experiencing?",
          updates,
        };

      case WorkflowState.CAPTURE_INTENT:
      case WorkflowState.MAP_SERVICE:
        // LLM-based service mapping (already done in LangGraph)
        return {
          response: "Thank you for sharing that. Let me make sure I understand your need correctly.",
          updates,
        };

      case WorkflowState.EMPATHIZE:
        return {
          response: `I understand ${args.variables.job_description ? 'your situation' : 'you need help'}. We'll get you taken care of. Can I get your phone number to look up your account?`,
          updates,
        };

      case WorkflowState.ASK_PHONE:
        return {
          response: "May I have your phone number to look up your account?",
          updates,
        };

      case WorkflowState.LOOKUP_CUSTOMER:
        // Call MCP to search customer by phone
        try {
          const result = await this.mcpAdapter.executeMCPTool(
            'customer_list',
            {
              query_primary_phone: args.variables.customer_phone,
            },
            args.authToken || ''
          );

          if (result.data && result.data.length > 0) {
            updates.customer_id = result.data[0].id;
            updates.customer_name = result.data[0].name;
            updates.customer_found = true;
            return {
              response: `Welcome back, ${result.data[0].name}! How can I help you today?`,
              updates,
            };
          } else {
            updates.customer_found = false;
            return {
              response: "I don't see an account with that number. No problem - let me create one for you! May I have your name?",
              updates,
            };
          }
        } catch (error: any) {
          console.error('[Worker] Customer lookup failed:', error.message);
          return {
            response: "Let me create a new account for you. May I have your name?",
            updates: { customer_found: false },
          };
        }

      case WorkflowState.CREATE_CUSTOMER:
        return {
          response: "Great! Let me get some information to set up your account.",
          updates,
        };

      case WorkflowState.ASK_NAME:
        return {
          response: "May I have your full name?",
          updates,
        };

      case WorkflowState.ASK_CITY:
        return {
          response: "Which city are you located in?",
          updates,
        };

      case WorkflowState.ASK_ADDRESS:
        return {
          response: "And what's your street address?",
          updates,
        };

      case WorkflowState.WELCOMING_EXISTING:
        return {
          response: `Perfect! What date works best for you?`,
          updates,
        };

      case WorkflowState.ASK_AVAILABILITY:
        return {
          response: "What date and time work best for you?",
          updates,
        };

      case WorkflowState.CREATE_TASK:
        // Create task via MCP
        try {
          const taskResult = await this.mcpAdapter.executeMCPTool(
            'task_create',
            {
              body_name: `${args.variables.service_category} Service`,
              body_task_stage: 'scheduled',
              body_customer_id: args.variables.customer_id,
              body_notes: args.variables.job_description,
            },
            args.authToken || ''
          );

          updates.task_id = taskResult.data?.id;
          updates.task_code = taskResult.data?.task_code;

          return {
            response: "Perfect! I'm creating your service request now...",
            updates,
          };
        } catch (error: any) {
          console.error('[Worker] Task creation failed:', error.message);
          throw error;
        }

      case WorkflowState.CREATE_BOOKING:
        // Create booking via MCP
        try {
          const bookingResult = await this.mcpAdapter.executeMCPTool(
            'booking_create',
            {
              body_customer_id: args.variables.customer_id,
              body_task_id: args.variables.task_id,
              body_scheduled_date: args.variables.desired_date,
              body_scheduled_time: args.variables.selected_time,
            },
            args.authToken || ''
          );

          updates.booking_id = bookingResult.data?.id;
          updates.booking_code = bookingResult.data?.booking_code;

          return {
            response: "Excellent! Your appointment has been scheduled.",
            updates,
          };
        } catch (error: any) {
          console.error('[Worker] Booking creation failed:', error.message);
          throw error;
        }

      case WorkflowState.CONFIRMATION:
        const bookingCode = args.variables.booking_code || args.variables.task_code || 'your booking';
        return {
          response: `All set! Your appointment is confirmed for ${args.variables.desired_date} at ${args.variables.selected_time}. Your confirmation number is ${bookingCode}. Is there anything else I can help you with?`,
          updates,
        };

      case WorkflowState.DONE:
        return {
          response: "Thank you for choosing our services! Have a great day!",
          updates,
        };

      default:
        return {
          response: "Let me help you with that.",
          updates,
        };
    }
  }

  /**
   * Handle circuit breaker open state
   */
  private async handleCircuitOpen(args: {
    sessionId: string;
    variables: Record<string, any>;
  }): Promise<CoordinatorResult> {
    return {
      naturalResponse: "I'm experiencing some technical difficulties. Let me connect you with one of our specialists who can help you complete your booking.",
      nextState: WorkflowState.FALLBACK,
      requiresUserInput: false,
      completed: false,
      conversationEnded: true,
      endReason: 'circuit_open',
      variables: args.variables,
    };
  }

  /**
   * Get conversation history
   */
  private getConversationHistory(sessionId: string): ChatCompletionMessageParam[] {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    return this.conversationHistory.get(sessionId)!;
  }

  /**
   * Update conversation history
   */
  private updateConversationHistory(
    sessionId: string,
    history: ChatCompletionMessageParam[]
  ): void {
    // Keep last 20 messages
    if (history.length > 20) {
      history = history.slice(-20);
    }
    this.conversationHistory.set(sessionId, history);
  }

  /**
   * Clear session cache
   */
  clearSessionCache(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
    this.circuitBreaker.clearCache(sessionId);
    this.plannerAgent.clearHistory(sessionId);
  }
}
