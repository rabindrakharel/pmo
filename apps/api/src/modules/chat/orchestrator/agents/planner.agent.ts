/**
 * Planner Agent
 * Decides next action based on workflow state and conversation context
 * Prevents loops by tracking decision history
 * @module orchestrator/agents/planner
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getOpenAIService } from '../services/openai.service.js';
import { WorkflowState, getStateMachineService } from '../state/state-machine.service.js';
import type { StateManager } from '../state/state-manager.service.js';

/**
 * Planner Decision
 */
export interface PlannerDecision {
  nextState: WorkflowState;
  action: string;
  reasoning: string;
  requiredInfo: string[];
  missingInfo: string[];
  naturalResponse?: string;
  requiresUserInput: boolean;
  completed: boolean;
  confidence: number;
}

/**
 * Decision History Entry
 */
interface DecisionHistoryEntry {
  state: WorkflowState;
  action: string;
  timestamp: Date;
}

/**
 * Loop Detection Result
 */
interface LoopDetection {
  isLooping: boolean;
  loopCount: number;
  repeatedState: WorkflowState | null;
  recommendation: string;
}

/**
 * Planner Agent
 */
export class PlannerAgent {
  private stateManager: StateManager;
  private stateMachine = getStateMachineService();
  private openaiService = getOpenAIService();

  // Track decision history to detect loops
  private decisionHistory: Map<string, DecisionHistoryEntry[]> = new Map();

  // Loop detection thresholds
  private readonly MAX_SAME_STATE_COUNT = 3;
  private readonly MAX_SAME_ACTION_COUNT = 3;
  private readonly LOOP_DETECTION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Plan next action based on current state
   */
  async plan(args: {
    sessionId: string;
    currentState: WorkflowState;
    variables: Record<string, any>;
    userMessage: string;
    conversationSummary?: string;
  }): Promise<PlannerDecision> {
    const startTime = Date.now();

    console.log(`[PlannerAgent] Planning from state: ${args.currentState}`);

    try {
      // Check for loops before planning
      const loopDetection = this.detectLoop(args.sessionId, args.currentState);
      if (loopDetection.isLooping) {
        console.warn(`[PlannerAgent] Loop detected: ${loopDetection.recommendation}`);

        // If stuck in loop, transition to error state
        return {
          nextState: WorkflowState.ERROR,
          action: 'escalate_to_fallback',
          reasoning: `Loop detected: ${loopDetection.recommendation}. Escalating to human agent.`,
          requiredInfo: [],
          missingInfo: [],
          naturalResponse: "I'm having trouble completing your request. Let me connect you with one of our specialists who can help you better.",
          requiresUserInput: false,
          completed: false,
          confidence: 100,
        };
      }

      // Analyze current state and decide next action
      const decision = await this.analyzeAndDecide(args);

      // Record decision in history
      this.recordDecision(args.sessionId, args.currentState, decision.action);

      // Log to database
      await this.stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'planner',
        agent_action: 'plan_next_action',
        node_context: args.currentState,
        input_data: {
          variables: args.variables,
          userMessage: args.userMessage,
        },
        output_data: {
          nextState: decision.nextState,
          action: decision.action,
          reasoning: decision.reasoning,
          confidence: decision.confidence,
        },
        success: true,
        duration_ms: Date.now() - startTime,
      });

      return decision;
    } catch (error: any) {
      console.error(`[PlannerAgent] Error planning:`, error);

      // Log error
      await this.stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'planner',
        agent_action: 'plan_next_action',
        node_context: args.currentState,
        input_data: {
          variables: args.variables,
          userMessage: args.userMessage,
        },
        success: false,
        error_message: error.message,
        duration_ms: Date.now() - startTime,
      });

      // Fallback to simple state machine logic on error
      return this.fallbackPlan(args.currentState, args.variables);
    }
  }

  /**
   * Analyze state and decide next action using GPT-4
   */
  private async analyzeAndDecide(args: {
    sessionId: string;
    currentState: WorkflowState;
    variables: Record<string, any>;
    userMessage: string;
    conversationSummary?: string;
  }): Promise<PlannerDecision> {
    const stateDescription = this.stateMachine.getStateDescription(args.currentState);
    const allowedTransitions = this.stateMachine.getAllowedTransitions(args.currentState);

    // Build system prompt
    const systemPrompt = `You are a planning agent for a home services booking system.

Current State: ${args.currentState} (${stateDescription})

Allowed Next States: ${allowedTransitions.join(', ')}

Variables Collected:
${JSON.stringify(args.variables, null, 2)}

${args.conversationSummary ? `Conversation Summary:\n${args.conversationSummary}` : ''}

Your job is to:
1. Analyze what information we have
2. Determine what information is still missing
3. Decide the next best state to transition to
4. Provide a natural response for the user if input is needed

Guidelines:
- Follow the state machine rules strictly
- Only transition to allowed states
- Ask for ONE piece of information at a time
- Be natural and conversational
- Confirm understanding before moving forward
- If customer seems frustrated or stuck, recommend fallback

Respond in JSON format:
{
  "next_state": "<state_name>",
  "action": "<action_description>",
  "reasoning": "<why this decision>",
  "required_info": ["<list of info needed for this flow>"],
  "missing_info": ["<list of info we don't have yet>"],
  "natural_response": "<optional: what to say to user>",
  "requires_user_input": <true/false>,
  "completed": <true/false>,
  "confidence": <0-100>
}`;

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `User message: "${args.userMessage}"` },
    ];

    const response = await this.openaiService.callAgent({
      agentType: 'planner',
      messages,
      temperature: 0.3,
      jsonMode: true,
    });

    try {
      const result = JSON.parse(response.content);

      // Validate the decision
      const nextState = result.next_state as WorkflowState;
      if (!allowedTransitions.includes(nextState)) {
        console.warn(`[PlannerAgent] Invalid transition suggested: ${nextState}, falling back to state machine logic`);
        return this.fallbackPlan(args.currentState, args.variables);
      }

      return {
        nextState,
        action: result.action || 'continue',
        reasoning: result.reasoning || 'No reasoning provided',
        requiredInfo: result.required_info || [],
        missingInfo: result.missing_info || [],
        naturalResponse: result.natural_response,
        requiresUserInput: result.requires_user_input || false,
        completed: result.completed || false,
        confidence: result.confidence || 70,
      };
    } catch (error) {
      console.error('[PlannerAgent] Failed to parse LLM response:', error);
      return this.fallbackPlan(args.currentState, args.variables);
    }
  }

  /**
   * Fallback planning using simple state machine logic
   */
  private fallbackPlan(
    currentState: WorkflowState,
    variables: Record<string, any>
  ): PlannerDecision {
    console.log('[PlannerAgent] Using fallback planning logic');

    const nextState = this.stateMachine.getNextState({
      currentState,
      hasCustomer: !!variables.customer_id,
      hasService: !!variables.service_category,
      hasPhone: !!variables.customer_phone,
      hasName: !!variables.customer_name,
      hasAddress: !!variables.customer_address && !!variables.customer_city,
      hasAvailability: !!variables.desired_date && !!variables.selected_time,
      taskCreated: !!variables.task_id,
      bookingCreated: !!variables.booking_id,
    });

    return {
      nextState,
      action: 'continue',
      reasoning: 'Fallback to state machine logic',
      requiredInfo: [],
      missingInfo: [],
      requiresUserInput: true,
      completed: false,
      confidence: 50,
    };
  }

  /**
   * Detect if we're stuck in a loop
   */
  private detectLoop(sessionId: string, currentState: WorkflowState): LoopDetection {
    const history = this.decisionHistory.get(sessionId) || [];

    // Filter recent decisions (within time window)
    const now = Date.now();
    const recentDecisions = history.filter(
      entry => now - entry.timestamp.getTime() < this.LOOP_DETECTION_WINDOW_MS
    );

    // Count how many times we've been in the same state
    const sameStateCount = recentDecisions.filter(entry => entry.state === currentState).length;

    // Count how many times we've taken the same action
    const actionCounts = new Map<string, number>();
    for (const entry of recentDecisions) {
      const key = `${entry.state}:${entry.action}`;
      actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
    }

    const maxActionCount = Math.max(...Array.from(actionCounts.values()), 0);

    // Check for loops
    if (sameStateCount >= this.MAX_SAME_STATE_COUNT) {
      return {
        isLooping: true,
        loopCount: sameStateCount,
        repeatedState: currentState,
        recommendation: `Stuck in state ${currentState} for ${sameStateCount} iterations`,
      };
    }

    if (maxActionCount >= this.MAX_SAME_ACTION_COUNT) {
      return {
        isLooping: true,
        loopCount: maxActionCount,
        repeatedState: currentState,
        recommendation: `Same action repeated ${maxActionCount} times`,
      };
    }

    return {
      isLooping: false,
      loopCount: 0,
      repeatedState: null,
      recommendation: '',
    };
  }

  /**
   * Record a decision in history
   */
  private recordDecision(sessionId: string, state: WorkflowState, action: string): void {
    if (!this.decisionHistory.has(sessionId)) {
      this.decisionHistory.set(sessionId, []);
    }

    const history = this.decisionHistory.get(sessionId)!;
    history.push({
      state,
      action,
      timestamp: new Date(),
    });

    // Keep only recent decisions (last 20)
    if (history.length > 20) {
      history.shift();
    }
  }

  /**
   * Clear decision history for session
   */
  clearHistory(sessionId: string): void {
    this.decisionHistory.delete(sessionId);
  }

  /**
   * Get decision history for debugging
   */
  getHistory(sessionId: string): DecisionHistoryEntry[] {
    return this.decisionHistory.get(sessionId) || [];
  }
}
