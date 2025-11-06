/**
 * Critic Agent
 * Quality control and boundary enforcement
 * @module orchestrator/agents/critic
 */

import type { AgentActionResult, IntentGraph } from '../types/intent-graph.types.js';
import { stateManager } from '../state/state-manager.service.js';

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
      // Check for off-topic requests
      const isOffTopic = this.detectOffTopic(
        args.userMessage,
        args.graph.boundaries.allowedTopics,
        args.graph.boundaries.forbiddenTopics
      );

      if (isOffTopic) {
        await stateManager.logAgentAction({
          session_id: args.sessionId,
          agent_role: 'critic',
          agent_action: 'review_conversation',
          output_data: { off_topic: true },
          success: true,
          natural_response: 'Off-topic request detected',
          duration_ms: Date.now() - startTime
        });

        return {
          success: false,
          agentRole: 'critic',
          action: 'review_conversation',
          error: 'off_topic',
          naturalResponse: this.generateOffTopicResponse(args.graph.name)
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

        return {
          success: false,
          agentRole: 'critic',
          action: 'review_conversation',
          error: 'max_turns_exceeded',
          naturalResponse: 'This conversation has been going on for a while. Would you like me to connect you with a human agent?'
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
   * Detect if user message is off-topic
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
}

// Export singleton instance
export const criticAgent = new CriticAgent();
