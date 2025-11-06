/**
 * Summarizer Agent
 * Tracks conversation progress and maintains context
 * Generates incremental summaries for efficient context management
 * @module orchestrator/agents/summarizer
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getOpenAIService } from '../services/openai.service.js';
import { WorkflowState, getStateMachineService } from '../state/state-machine.service.js';
import type { StateManager } from '../state/state-manager.service.js';

/**
 * Conversation Summary
 */
export interface ConversationSummary {
  fullSummary: string;
  currentPhase: string;
  progressPercentage: number;
  collectedInfo: Record<string, any>;
  missingInfo: string[];
  nextSteps: string[];
  customerSentiment?: 'positive' | 'neutral' | 'frustrated' | 'confused';
}

/**
 * Summarizer Agent
 */
export class SummarizerAgent {
  private stateManager: StateManager;
  private stateMachine = getStateMachineService();
  private openaiService = getOpenAIService();

  // Summarization frequency
  private readonly SUMMARIZE_EVERY_N_MESSAGES = 5;
  private readonly SUMMARIZE_ON_STATE_CHANGE = true;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Generate conversation summary
   */
  async summarize(args: {
    sessionId: string;
    currentState: WorkflowState;
    variables: Record<string, any>;
    conversationHistory: ChatCompletionMessageParam[];
    previousSummary?: string;
  }): Promise<ConversationSummary> {
    const startTime = Date.now();

    console.log(`[SummarizerAgent] Summarizing conversation at state: ${args.currentState}`);

    try {
      // Get agent logs for context
      const agentLogs = await this.stateManager.getAgentLogs(args.sessionId, { limit: 20 });

      // Generate summary using LLM
      const summary = await this.generateSummaryWithLLM(args);

      // Calculate progress percentage
      const progressPercentage = this.calculateProgress(args.currentState);

      // Identify missing information
      const missingInfo = this.identifyMissingInfo(args.currentState, args.variables);

      // Determine next steps
      const nextSteps = this.determineNextSteps(args.currentState, args.variables);

      // Build final summary
      const result: ConversationSummary = {
        fullSummary: summary.text,
        currentPhase: this.getPhaseDescription(args.currentState),
        progressPercentage,
        collectedInfo: this.extractCollectedInfo(args.variables),
        missingInfo,
        nextSteps,
        customerSentiment: summary.sentiment,
      };

      // Save summary to database
      await this.stateManager.saveSummary({
        session_id: args.sessionId,
        summary_type: args.previousSummary ? 'incremental' : 'full',
        summary_text: result.fullSummary,
        up_to_node: args.currentState,
        message_count: args.conversationHistory.length,
      });

      // Update session with summary
      await this.stateManager.updateSession(args.sessionId, {
        conversation_summary: result.fullSummary,
      });

      // Log summarization action
      await this.stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'summarizer',
        agent_action: 'generate_summary',
        node_context: args.currentState,
        output_data: result,
        success: true,
        duration_ms: Date.now() - startTime,
      });

      console.log(`[SummarizerAgent] Summary generated: ${progressPercentage}% complete`);

      return result;
    } catch (error: any) {
      console.error(`[SummarizerAgent] Error generating summary:`, error);

      // Log error
      await this.stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'summarizer',
        agent_action: 'generate_summary',
        node_context: args.currentState,
        success: false,
        error_message: error.message,
        duration_ms: Date.now() - startTime,
      });

      // Return fallback summary
      return this.fallbackSummary(args.currentState, args.variables);
    }
  }

  /**
   * Generate summary using LLM
   */
  private async generateSummaryWithLLM(args: {
    currentState: WorkflowState;
    variables: Record<string, any>;
    conversationHistory: ChatCompletionMessageParam[];
    previousSummary?: string;
  }): Promise<{ text: string; sentiment?: 'positive' | 'neutral' | 'frustrated' | 'confused' }> {
    const stateDescription = this.stateMachine.getStateDescription(args.currentState);

    const systemPrompt = `You are a conversation summarizer for a home services booking system.

Current State: ${args.currentState} (${stateDescription})

Variables Collected:
${JSON.stringify(args.variables, null, 2)}

${args.previousSummary ? `Previous Summary:\n${args.previousSummary}\n\n` : ''}

Your job is to:
1. Summarize the conversation progress concisely
2. Highlight what information has been collected
3. Identify customer sentiment (positive, neutral, frustrated, confused)
4. Note any issues or blockers

Keep the summary to 3-4 sentences maximum, focusing on key facts and progress.

Respond in JSON format:
{
  "summary": "<concise summary>",
  "sentiment": "<positive|neutral|frustrated|confused>",
  "key_points": ["<point 1>", "<point 2>", ...]
}`;

    // Take last 10 messages for context
    const recentHistory = args.conversationHistory.slice(-10);

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: 'Please summarize the conversation so far.' },
    ];

    const response = await this.openaiService.callAgent({
      agentType: 'summarizer',
      messages,
      temperature: 0.3,
      jsonMode: true,
    });

    try {
      const result = JSON.parse(response.content);
      return {
        text: result.summary || 'Booking in progress.',
        sentiment: result.sentiment,
      };
    } catch (error) {
      console.error('[SummarizerAgent] Failed to parse LLM response');
      return {
        text: 'Customer is working through the booking process.',
        sentiment: 'neutral',
      };
    }
  }

  /**
   * Calculate progress percentage based on workflow state
   */
  private calculateProgress(state: WorkflowState): number {
    const progressMap: Record<WorkflowState, number> = {
      [WorkflowState.GREETING]: 5,
      [WorkflowState.ASK_PROBLEM]: 10,
      [WorkflowState.CAPTURE_INTENT]: 15,
      [WorkflowState.MAP_SERVICE]: 20,
      [WorkflowState.EMPATHIZE]: 25,
      [WorkflowState.ASK_PHONE]: 30,
      [WorkflowState.LOOKUP_CUSTOMER]: 35,
      [WorkflowState.CREATE_CUSTOMER]: 40,
      [WorkflowState.ASK_NAME]: 45,
      [WorkflowState.ASK_CITY]: 50,
      [WorkflowState.ASK_ADDRESS]: 55,
      [WorkflowState.WELCOMING_EXISTING]: 40,
      [WorkflowState.ASK_AVAILABILITY]: 70,
      [WorkflowState.CREATE_TASK]: 85,
      [WorkflowState.CREATE_BOOKING]: 90,
      [WorkflowState.CONFIRMATION]: 95,
      [WorkflowState.DONE]: 100,
      [WorkflowState.ERROR]: 0,
      [WorkflowState.FALLBACK]: 0,
    };

    return progressMap[state] || 0;
  }

  /**
   * Get human-readable phase description
   */
  private getPhaseDescription(state: WorkflowState): string {
    if ([
      WorkflowState.GREETING,
      WorkflowState.ASK_PROBLEM,
      WorkflowState.CAPTURE_INTENT,
      WorkflowState.MAP_SERVICE,
      WorkflowState.EMPATHIZE
    ].includes(state)) {
      return 'Problem Identification';
    }

    if ([
      WorkflowState.ASK_PHONE,
      WorkflowState.LOOKUP_CUSTOMER,
      WorkflowState.WELCOMING_EXISTING
    ].includes(state)) {
      return 'Customer Identification';
    }

    if ([
      WorkflowState.CREATE_CUSTOMER,
      WorkflowState.ASK_NAME,
      WorkflowState.ASK_CITY,
      WorkflowState.ASK_ADDRESS
    ].includes(state)) {
      return 'Customer Information Collection';
    }

    if (state === WorkflowState.ASK_AVAILABILITY) {
      return 'Availability Selection';
    }

    if ([
      WorkflowState.CREATE_TASK,
      WorkflowState.CREATE_BOOKING,
      WorkflowState.CONFIRMATION
    ].includes(state)) {
      return 'Booking Creation';
    }

    if (state === WorkflowState.DONE) {
      return 'Completed';
    }

    return 'In Progress';
  }

  /**
   * Identify missing information based on workflow state
   */
  private identifyMissingInfo(state: WorkflowState, variables: Record<string, any>): string[] {
    const missing: string[] = [];

    // Problem/service information
    if (!variables.job_description) missing.push('Problem description');
    if (!variables.service_category) missing.push('Service category');

    // Customer information
    if (!variables.customer_phone) missing.push('Phone number');
    if (!variables.customer_name) missing.push('Customer name');
    if (!variables.customer_city) missing.push('City');
    if (!variables.customer_address) missing.push('Street address');

    // Booking information
    if (!variables.desired_date) missing.push('Preferred date');
    if (!variables.selected_time) missing.push('Preferred time');

    // IDs
    if (!variables.customer_id) missing.push('Customer ID');
    if (!variables.task_id) missing.push('Task ID');
    if (!variables.booking_id) missing.push('Booking ID');

    return missing;
  }

  /**
   * Determine next steps based on current state
   */
  private determineNextSteps(state: WorkflowState, variables: Record<string, any>): string[] {
    const stateMachine = getStateMachineService();
    const allowedTransitions = stateMachine.getAllowedTransitions(state);

    return allowedTransitions.map(nextState => stateMachine.getStateDescription(nextState));
  }

  /**
   * Extract collected information from variables
   */
  private extractCollectedInfo(variables: Record<string, any>): Record<string, any> {
    const collected: Record<string, any> = {};

    // Only include non-empty, user-facing variables
    const relevantKeys = [
      'customer_name',
      'customer_phone',
      'customer_email',
      'customer_city',
      'customer_address',
      'service_category',
      'job_description',
      'desired_date',
      'selected_time',
      'task_code',
      'booking_code',
    ];

    for (const key of relevantKeys) {
      if (variables[key]) {
        collected[key] = variables[key];
      }
    }

    return collected;
  }

  /**
   * Fallback summary when LLM fails
   */
  private fallbackSummary(state: WorkflowState, variables: Record<string, any>): ConversationSummary {
    return {
      fullSummary: `Booking conversation in progress at ${state}.`,
      currentPhase: this.getPhaseDescription(state),
      progressPercentage: this.calculateProgress(state),
      collectedInfo: this.extractCollectedInfo(variables),
      missingInfo: this.identifyMissingInfo(state, variables),
      nextSteps: this.determineNextSteps(state, variables),
      customerSentiment: 'neutral',
    };
  }

  /**
   * Check if summarization is needed based on message count
   */
  shouldSummarize(args: {
    messageCount: number;
    lastSummaryMessageCount?: number;
    stateChanged: boolean;
  }): boolean {
    // Summarize if state changed
    if (this.SUMMARIZE_ON_STATE_CHANGE && args.stateChanged) {
      return true;
    }

    // Summarize every N messages
    const messagesSinceLastSummary = args.messageCount - (args.lastSummaryMessageCount || 0);
    if (messagesSinceLastSummary >= this.SUMMARIZE_EVERY_N_MESSAGES) {
      return true;
    }

    return false;
  }
}
