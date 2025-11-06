/**
 * Critic Agent
 * Quality control and boundary enforcement
 * @module orchestrator/agents/critic
 */

import type { AgentActionResult, IntentGraph } from '../types/intent-graph.types.js';
import { stateManager } from '../state/state-manager.service.js';
import { getGoodbyeMessage } from '../config/engaging-messages.config.js';
import { getOpenAIService } from '../services/openai.service.js';

/**
 * Critic Agent
 * Reviews outputs for quality, safety, and boundary compliance
 */
export class CriticAgent {
  /**
   * Review conversation for off-topic drift
   */
  async reviewConversation(args: {
    sessionId: string;
    graph: IntentGraph;
    userMessage: string;
    state: Record<string, any>;
  }): Promise<AgentActionResult> {
    const startTime = Date.now();

    try {
      // Check for off-topic requests using LLM
      const isOffTopic = await this.detectOffTopicWithLLM(
        args.userMessage,
        args.graph.boundaries.allowedTopics,
        args.graph.boundaries.forbiddenTopics
      );

      if (isOffTopic) {
        // Track off-topic attempts
        const offTopicCount = (args.state._off_topic_count || 0) + 1;
        await stateManager.setState(args.sessionId, '_off_topic_count', offTopicCount, {
          source: 'critic',
          validated: true
        });

        await stateManager.logAgentAction({
          session_id: args.sessionId,
          agent_role: 'critic',
          agent_action: 'review_conversation',
          output_data: { off_topic: true, off_topic_count: offTopicCount },
          success: true,
          natural_response: 'Off-topic request detected',
          duration_ms: Date.now() - startTime
        });

        // After 2 off-topic attempts, end conversation
        if (offTopicCount >= 2) {
          const goodbyeMessage = getGoodbyeMessage('off_topic');

          return {
            success: false,
            agentRole: 'critic',
            action: 'review_conversation',
            error: 'off_topic_repeated',
            naturalResponse: goodbyeMessage,
            shouldEndConversation: true,
            endReason: 'off_topic'
          };
        }

        return {
          success: false,
          agentRole: 'critic',
          action: 'review_conversation',
          error: 'off_topic',
          naturalResponse: this.generateOffTopicResponse(args.graph.name) + ' (This is your first warning.)'
        };
      }

      // Check conversation length (prevent infinite loops)
      const turnCount = (args.state._turn_count || 0) + 1;
      if (args.graph.boundaries.maxTurns && turnCount > args.graph.boundaries.maxTurns) {
        await stateManager.logAgentAction({
          session_id: args.sessionId,
          agent_role: 'critic',
          agent_action: 'review_conversation',
          output_data: { max_turns_exceeded: true, turn_count: turnCount },
          success: true,
          natural_response: 'Maximum conversation length exceeded',
          duration_ms: Date.now() - startTime
        });

        const goodbyeMessage = getGoodbyeMessage('max_turns');

        return {
          success: false,
          agentRole: 'critic',
          action: 'review_conversation',
          error: 'max_turns_exceeded',
          naturalResponse: goodbyeMessage,
          shouldEndConversation: true,
          endReason: 'max_turns'
        };
      }

      // Update turn count
      await stateManager.setState(args.sessionId, '_turn_count', turnCount, {
        source: 'critic',
        validated: true
      });

      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'critic',
        agent_action: 'review_conversation',
        output_data: { off_topic: false, turn_count: turnCount },
        success: true,
        duration_ms: Date.now() - startTime
      });

      return {
        success: true,
        agentRole: 'critic',
        action: 'review_conversation'
      };
    } catch (error: any) {
      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'critic',
        agent_action: 'review_conversation',
        success: false,
        error_message: error.message,
        duration_ms: Date.now() - startTime
      });

      return {
        success: false,
        agentRole: 'critic',
        action: 'review_conversation',
        error: error.message
      };
    }
  }

  /**
   * Review worker output for quality issues
   */
  async reviewWorkerOutput(args: {
    sessionId: string;
    graph: IntentGraph;
    nodeContext: string;
    workerResult: AgentActionResult;
    state: Record<string, any>;
  }): Promise<AgentActionResult> {
    const startTime = Date.now();

    try {
      const issues: string[] = [];

      // Check for hallucination indicators
      if (this.detectHallucination(args.workerResult, args.state)) {
        issues.push('Possible hallucination detected');
      }

      // Check for inconsistencies
      if (this.detectInconsistency(args.workerResult, args.state)) {
        issues.push('Inconsistent data detected');
      }

      // Check for missing critical information
      if (this.detectMissingCriticalInfo(args.workerResult, args.nodeContext)) {
        issues.push('Missing critical information');
      }

      if (issues.length > 0) {
        await stateManager.logAgentAction({
          session_id: args.sessionId,
          agent_role: 'critic',
          agent_action: 'review_worker_output',
          node_context: args.nodeContext,
          output_data: { issues },
          success: true,
          natural_response: 'Quality issues found',
          duration_ms: Date.now() - startTime
        });

        return {
          success: false,
          agentRole: 'critic',
          action: 'review_worker_output',
          error: issues.join('; '),
          naturalResponse: 'Let me verify that information before we proceed.'
        };
      }

      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'critic',
        agent_action: 'review_worker_output',
        node_context: args.nodeContext,
        output_data: { quality_check: 'passed' },
        success: true,
        duration_ms: Date.now() - startTime
      });

      return {
        success: true,
        agentRole: 'critic',
        action: 'review_worker_output'
      };
    } catch (error: any) {
      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'critic',
        agent_action: 'review_worker_output',
        node_context: args.nodeContext,
        success: false,
        error_message: error.message,
        duration_ms: Date.now() - startTime
      });

      return {
        success: false,
        agentRole: 'critic',
        action: 'review_worker_output',
        error: error.message
      };
    }
  }

  /**
   * Check if custom boundary rules are violated
   */
  async checkBoundaryRules(args: {
    sessionId: string;
    graph: IntentGraph;
    currentNode: string;
    state: Record<string, any>;
  }): Promise<AgentActionResult> {
    const startTime = Date.now();

    try {
      if (!args.graph.boundaries.customRules || args.graph.boundaries.customRules.length === 0) {
        return {
          success: true,
          agentRole: 'critic',
          action: 'check_boundary_rules'
        };
      }

      const violations: string[] = [];

      for (const rule of args.graph.boundaries.customRules) {
        const violated = this.evaluateCustomRule(rule, args.currentNode, args.state);
        if (violated) {
          violations.push(rule);
        }
      }

      if (violations.length > 0) {
        await stateManager.logAgentAction({
          session_id: args.sessionId,
          agent_role: 'critic',
          agent_action: 'check_boundary_rules',
          node_context: args.currentNode,
          output_data: { violations },
          success: true,
          natural_response: 'Boundary rule violations detected',
          duration_ms: Date.now() - startTime
        });

        return {
          success: false,
          agentRole: 'critic',
          action: 'check_boundary_rules',
          error: violations.join('; '),
          naturalResponse: 'Let me make sure we follow the proper process.'
        };
      }

      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'critic',
        agent_action: 'check_boundary_rules',
        node_context: args.currentNode,
        success: true,
        duration_ms: Date.now() - startTime
      });

      return {
        success: true,
        agentRole: 'critic',
        action: 'check_boundary_rules'
      };
    } catch (error: any) {
      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'critic',
        agent_action: 'check_boundary_rules',
        node_context: args.currentNode,
        success: false,
        error_message: error.message,
        duration_ms: Date.now() - startTime
      });

      return {
        success: false,
        agentRole: 'critic',
        action: 'check_boundary_rules',
        error: error.message
      };
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Detect if user message is off-topic using LLM
   */
  private async detectOffTopicWithLLM(
    message: string,
    allowedTopics: string[],
    forbiddenTopics: string[]
  ): Promise<boolean> {
    try {
      const openaiService = getOpenAIService();

      const result = await openaiService.checkOffTopic({
        userMessage: message,
        allowedTopics,
        forbiddenTopics,
      });

      console.log(`[Critic] Off-topic check: ${result.isOffTopic ? 'YES' : 'NO'} (cost: $${(result.costCents / 100).toFixed(4)})`);
      console.log(`[Critic] Reason: ${result.reason}`);

      return result.isOffTopic;
    } catch (error: any) {
      console.error('[Critic] Error checking off-topic with LLM, falling back to keyword matching:', error.message);

      // Fallback to keyword-based detection
      return this.detectOffTopic(message, allowedTopics, forbiddenTopics);
    }
  }

  /**
   * Detect if user message is off-topic (fallback method using keywords)
   */
  private detectOffTopic(
    message: string,
    allowedTopics: string[],
    forbiddenTopics: string[]
  ): boolean {
    const lowerMessage = message.toLowerCase();

    // Check for forbidden topics
    for (const forbidden of forbiddenTopics) {
      if (lowerMessage.includes(forbidden.toLowerCase())) {
        return true;
      }
    }

    // Check if message contains any allowed topic keywords
    // (Simple keyword matching - in production, use semantic similarity)
    const hasAllowedTopic = allowedTopics.some(topic =>
      lowerMessage.includes(topic.toLowerCase())
    );

    // If message is very generic (greeting, confirmation), it's on-topic
    const genericPatterns = [
      /^(hi|hello|hey|yes|no|ok|okay|sure|thanks|thank you)/i,
      /\?$/  // Questions are generally on-topic
    ];

    const isGeneric = genericPatterns.some(pattern => pattern.test(message.trim()));

    return !hasAllowedTopic && !isGeneric;
  }

  /**
   * Generate off-topic response
   */
  private generateOffTopicResponse(intentName: string): string {
    const responses: Record<string, string> = {
      CalendarBooking: 'I\'m specifically here to help with service bookings. Can I help you schedule an appointment?',
      ComplaintHandling: 'I\'m here to help with service complaints and issues. Can I help with a service concern?'
    };

    return responses[intentName] || 'I\'m specifically here to help with our services. How can I assist you?';
  }

  /**
   * Detect potential hallucination
   * (Simplified - in production, use more sophisticated checks)
   */
  private detectHallucination(result: AgentActionResult, state: Record<string, any>): boolean {
    // Check if worker claimed success but produced no state updates
    if (result.success && result.action === 'mcp_call' && (!result.stateUpdates || Object.keys(result.stateUpdates).length === 0)) {
      return true;
    }

    return false;
  }

  /**
   * Detect inconsistencies in data
   */
  private detectInconsistency(result: AgentActionResult, state: Record<string, any>): boolean {
    // Check if state updates contradict existing state
    if (result.stateUpdates) {
      for (const [key, newValue] of Object.entries(result.stateUpdates)) {
        const oldValue = state[key];
        if (oldValue !== undefined && oldValue !== newValue) {
          // Value changed - check if it's a contradiction
          if (key.includes('id') && oldValue && newValue && oldValue !== newValue) {
            return true; // ID fields shouldn't change
          }
        }
      }
    }

    return false;
  }

  /**
   * Detect missing critical information
   */
  private detectMissingCriticalInfo(result: AgentActionResult, nodeContext: string): boolean {
    // Check if critical nodes have proper responses
    if (nodeContext.includes('create') || nodeContext.includes('booking')) {
      if (!result.naturalResponse || result.naturalResponse.length < 10) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate custom boundary rule
   */
  private evaluateCustomRule(rule: string, currentNode: string, state: Record<string, any>): boolean {
    const lowerRule = rule.toLowerCase();

    // "Never create booking without explicit user confirmation"
    if (lowerRule.includes('never create booking without') && lowerRule.includes('confirmation')) {
      if (currentNode.includes('create_booking') && !state._user_confirmed_booking) {
        return true;
      }
    }

    // "Always verify customer identity before proceeding"
    if (lowerRule.includes('verify customer identity')) {
      if (!state.customer_id && currentNode !== 'identify_customer' && currentNode !== 'create_customer') {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate input data for workflow states
   */
  async validateInputData(args: {
    sessionId: string;
    currentState: string;
    variables: Record<string, any>;
  }): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate phone number format
    if (args.variables.customer_phone) {
      const phoneValidation = this.validatePhone(args.variables.customer_phone);
      if (!phoneValidation.valid) {
        errors.push(`Invalid phone number: ${phoneValidation.error}`);
      }
    }

    // Validate email format
    if (args.variables.customer_email) {
      const emailValidation = this.validateEmail(args.variables.customer_email);
      if (!emailValidation.valid) {
        errors.push(`Invalid email: ${emailValidation.error}`);
      }
    }

    // Validate date format
    if (args.variables.desired_date) {
      const dateValidation = this.validateDate(args.variables.desired_date);
      if (!dateValidation.valid) {
        errors.push(`Invalid date: ${dateValidation.error}`);
      } else if (dateValidation.warning) {
        warnings.push(dateValidation.warning);
      }
    }

    // Validate time format
    if (args.variables.selected_time) {
      const timeValidation = this.validateTime(args.variables.selected_time);
      if (!timeValidation.valid) {
        errors.push(`Invalid time: ${timeValidation.error}`);
      }
    }

    // Validate required fields based on workflow state
    const stateRequirements = this.getStateRequirements(args.currentState);
    for (const requiredField of stateRequirements.required) {
      if (!args.variables[requiredField]) {
        errors.push(`Missing required field: ${requiredField}`);
      }
    }

    // Log validation result
    await stateManager.logAgentAction({
      session_id: args.sessionId,
      agent_role: 'critic',
      agent_action: 'validate_input_data',
      node_context: args.currentState,
      output_data: { errors, warnings },
      success: errors.length === 0,
      natural_response: errors.length > 0 ? errors.join('; ') : 'Input validation passed',
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate phone number format
   */
  private validatePhone(phone: string): { valid: boolean; error?: string } {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // Must be exactly 10 digits (North American format)
    if (digitsOnly.length !== 10) {
      return {
        valid: false,
        error: 'Phone number must be 10 digits',
      };
    }

    // First digit can't be 0 or 1
    if (digitsOnly[0] === '0' || digitsOnly[0] === '1') {
      return {
        valid: false,
        error: 'Phone number cannot start with 0 or 1',
      };
    }

    return { valid: true };
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): { valid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return {
        valid: false,
        error: 'Invalid email format',
      };
    }

    return { valid: true };
  }

  /**
   * Validate date format and constraints
   */
  private validateDate(dateStr: string): { valid: boolean; error?: string; warning?: string } {
    // Expected format: YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(dateStr)) {
      return {
        valid: false,
        error: 'Date must be in YYYY-MM-DD format',
      };
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return {
        valid: false,
        error: 'Invalid date',
      };
    }

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return {
        valid: false,
        error: 'Date cannot be in the past',
      };
    }

    // Warn if date is more than 3 months in the future
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    if (date > threeMonthsFromNow) {
      return {
        valid: true,
        warning: 'Date is more than 3 months in the future',
      };
    }

    return { valid: true };
  }

  /**
   * Validate time format
   */
  private validateTime(timeStr: string): { valid: boolean; error?: string } {
    // Expected formats: "9:00 AM", "14:30", "2:30 PM"
    const timeRegex12Hour = /^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i;
    const timeRegex24Hour = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

    if (!timeRegex12Hour.test(timeStr) && !timeRegex24Hour.test(timeStr)) {
      return {
        valid: false,
        error: 'Time must be in format "9:00 AM" or "14:30"',
      };
    }

    return { valid: true };
  }

  /**
   * Get required fields for a workflow state
   */
  private getStateRequirements(state: string): { required: string[]; optional: string[] } {
    const requirements: Record<string, { required: string[]; optional: string[] }> = {
      lookup_customer: {
        required: ['customer_phone'],
        optional: [],
      },
      create_customer: {
        required: ['customer_phone', 'customer_name'],
        optional: ['customer_email', 'customer_city', 'customer_address'],
      },
      ask_availability: {
        required: ['customer_id', 'service_category', 'job_description'],
        optional: [],
      },
      create_task: {
        required: ['customer_id', 'service_category', 'job_description', 'desired_date', 'selected_time'],
        optional: [],
      },
      create_booking: {
        required: ['customer_id', 'task_id', 'desired_date', 'selected_time'],
        optional: [],
      },
    };

    return requirements[state] || { required: [], optional: [] };
  }
}

// Export singleton instance
export const criticAgent = new CriticAgent();
