/**
 * Main Orchestrator Service
 * Coordinates multi-agent workflow execution
 * @module orchestrator
 */

import { stateManager } from './state/state-manager.service.js';
import { authenticatorAgent } from './agents/authenticator.agent.js';
import { workerAgent } from './agents/worker.agent.js';
import { evaluatorAgent } from './agents/evaluator.agent.js';
import { criticAgent } from './agents/critic.agent.js';
import { getIntentGraph, getAvailableIntents } from './intent-graphs/index.js';
import type { IntentGraph, GraphNode, AgentActionResult, IntentDetectionResult } from './types/intent-graph.types.js';

/**
 * Orchestrated Message Request
 */
export interface OrchestratedMessageRequest {
  sessionId?: string;  // If continuing existing session
  message: string;
  authToken?: string;
  chatSessionId?: string;  // Link to chat interaction
  userId?: string;
  tenantId?: string;
}

/**
 * Orchestrated Message Response
 */
export interface OrchestratedMessageResponse {
  sessionId: string;
  response: string;
  intent?: string;
  currentNode?: string;
  requiresUserInput?: boolean;
  completed?: boolean;
  error?: string;
  agentLogs?: Array<{
    agent: string;
    action: string;
    success: boolean;
  }>;
}

/**
 * Main Orchestrator Service
 */
export class OrchestratorService {
  /**
   * Process a user message through the multi-agent orchestration
   */
  async processMessage(request: OrchestratedMessageRequest): Promise<OrchestratedMessageResponse> {
    let sessionId = request.sessionId;
    let session;

    try {
      // 1. Get or create session
      if (sessionId) {
        session = await stateManager.getSession(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }
      } else {
        // Create new session
        session = await stateManager.createSession({
          chat_session_id: request.chatSessionId,
          user_id: request.userId,
          tenant_id: request.tenantId,
          auth_metadata: {}
        });
        sessionId = session.id;
      }

      // 2. Authenticate (if token provided or required)
      const authResult = await authenticatorAgent.authenticate({
        sessionId: session.id,
        authToken: request.authToken
      });

      if (!authResult.success && request.authToken) {
        return {
          sessionId: session.id,
          response: authResult.naturalResponse || 'Authentication failed',
          error: authResult.error
        };
      }

      // Get current state
      let state = await stateManager.getAllState(session.id);

      // 3. Detect or use existing intent
      let graph: IntentGraph;
      if (!session.current_intent) {
        const intentResult = await this.detectIntent(request.message, state);

        if (!intentResult.intent) {
          return {
            sessionId: session.id,
            response: 'I\'m not sure how to help with that. Can you tell me more about what you need?',
            error: 'intent_detection_failed'
          };
        }

        graph = getIntentGraph(intentResult.intent)!;

        // Check permissions
        if (graph.requiredPermissions && graph.requiredPermissions.length > 0) {
          const authCheck = await authenticatorAgent.authenticate({
            sessionId: session.id,
            authToken: request.authToken,
            requiredPermissions: graph.requiredPermissions
          });

          if (!authCheck.success) {
            return {
              sessionId: session.id,
              response: authCheck.naturalResponse || 'You don\'t have permission for this action',
              error: 'permission_denied'
            };
          }
        }

        // Set intent
        await stateManager.updateSession(session.id, {
          current_intent: intentResult.intent,
          current_node: graph.startNode
        });

        session.current_intent = intentResult.intent;
        session.current_node = graph.startNode;
      } else {
        graph = getIntentGraph(session.current_intent)!;
        if (!graph) {
          throw new Error(`Intent graph not found: ${session.current_intent}`);
        }
      }

      // 4. Critic: Check conversation boundaries
      const criticResult = await criticAgent.reviewConversation({
        sessionId: session.id,
        graph,
        userMessage: request.message,
        state
      });

      if (!criticResult.success) {
        return {
          sessionId: session.id,
          response: criticResult.naturalResponse || 'Let\'s stay on topic.',
          intent: session.current_intent,
          currentNode: session.current_node || undefined
        };
      }

      // 5. Execute workflow
      const workflowResult = await this.executeWorkflow({
        sessionId: session.id,
        graph,
        currentNode: session.current_node || graph.startNode,
        userMessage: request.message,
        authToken: request.authToken,
        state
      });

      return {
        sessionId: session.id,
        response: workflowResult.response,
        intent: session.current_intent,
        currentNode: workflowResult.nextNode,
        requiresUserInput: workflowResult.requiresUserInput,
        completed: workflowResult.completed,
        agentLogs: workflowResult.agentLogs
      };
    } catch (error: any) {
      console.error('Orchestrator error:', error);

      return {
        sessionId: sessionId || 'unknown',
        response: 'I encountered an error. Let me try a different approach.',
        error: error.message
      };
    }
  }

  /**
   * Execute workflow from current node
   */
  private async executeWorkflow(args: {
    sessionId: string;
    graph: IntentGraph;
    currentNode: string;
    userMessage: string;
    authToken?: string;
    state: Record<string, any>;
  }): Promise<{
    response: string;
    nextNode?: string;
    requiresUserInput?: boolean;
    completed?: boolean;
    agentLogs: Array<{ agent: string; action: string; success: boolean }>;
  }> {
    const agentLogs: Array<{ agent: string; action: string; success: boolean }> = [];
    let currentNode = args.currentNode;
    let state = { ...args.state };
    let finalResponse = '';
    let maxIterations = 10; // Prevent infinite loops
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const node = args.graph.nodes[currentNode];
      if (!node) {
        throw new Error(`Node not found: ${currentNode}`);
      }

      console.log(`🎯 Orchestrator executing node: ${node.id}`);

      // Refresh state
      state = await stateManager.getAllState(args.sessionId);

      // Execute node actions
      let workerResult: AgentActionResult | undefined;

      for (const action of node.actions) {
        workerResult = await workerAgent.executeAction({
          sessionId: args.sessionId,
          nodeContext: node.id,
          action,
          state,
          authToken: args.authToken,
          userMessage: args.userMessage
        });

        agentLogs.push({
          agent: 'worker',
          action: `execute_${action.type}`,
          success: workerResult.success
        });

        // Update state with worker results
        if (workerResult.stateUpdates) {
          state = { ...state, ...workerResult.stateUpdates };
        }

        // If worker needs user input, return immediately
        if (workerResult.requiresUserInput) {
          await stateManager.updateSession(args.sessionId, {
            current_node: currentNode,
            session_context: state
          });

          return {
            response: workerResult.naturalResponse || 'Please provide more information.',
            nextNode: currentNode,
            requiresUserInput: true,
            agentLogs
          };
        }

        // Collect natural response
        if (workerResult.naturalResponse) {
          finalResponse = workerResult.naturalResponse;
        }

        // Stop if worker failed
        if (!workerResult.success) {
          await stateManager.updateSession(args.sessionId, {
            current_node: currentNode,
            session_context: state
          });

          return {
            response: workerResult.naturalResponse || workerResult.error || 'An error occurred.',
            nextNode: currentNode,
            agentLogs
          };
        }
      }

      // Critic: Check worker output quality
      if (workerResult) {
        const criticReview = await criticAgent.reviewWorkerOutput({
          sessionId: args.sessionId,
          graph: args.graph,
          nodeContext: node.id,
          workerResult,
          state
        });

        agentLogs.push({
          agent: 'critic',
          action: 'review_worker_output',
          success: criticReview.success
        });

        if (!criticReview.success) {
          // Quality issue - retry or ask for clarification
          await stateManager.updateSession(args.sessionId, {
            current_node: currentNode,
            session_context: state
          });

          return {
            response: criticReview.naturalResponse || 'Let me verify that information.',
            nextNode: currentNode,
            requiresUserInput: true,
            agentLogs
          };
        }
      }

      // Evaluator: Validate node completion
      const evalResult = await evaluatorAgent.evaluateNode({
        sessionId: args.sessionId,
        node,
        state,
        workerResult
      });

      agentLogs.push({
        agent: 'evaluator',
        action: 'validate_node',
        success: evalResult.success
      });

      if (!evalResult.success) {
        // Validation failed - stay on current node
        await stateManager.updateSession(args.sessionId, {
          current_node: currentNode,
          session_context: state
        });

        return {
          response: evalResult.naturalResponse || evalResult.error || 'Please provide the required information.',
          nextNode: currentNode,
          requiresUserInput: true,
          agentLogs
        };
      }

      // Critic: Check boundary rules
      const boundaryCheck = await criticAgent.checkBoundaryRules({
        sessionId: args.sessionId,
        graph: args.graph,
        currentNode: node.id,
        state
      });

      agentLogs.push({
        agent: 'critic',
        action: 'check_boundary_rules',
        success: boundaryCheck.success
      });

      if (!boundaryCheck.success) {
        await stateManager.updateSession(args.sessionId, {
          current_node: currentNode,
          session_context: state
        });

        return {
          response: boundaryCheck.naturalResponse || 'Let\'s make sure we follow the proper process.',
          nextNode: currentNode,
          requiresUserInput: true,
          agentLogs
        };
      }

      // Determine next node
      const nextNode = evalResult.nextNode;

      if (!nextNode) {
        // No more nodes - workflow complete!
        await stateManager.updateSession(args.sessionId, {
          current_node: currentNode,
          status: 'completed',
          session_context: state
        });

        await stateManager.completeSession(args.sessionId, 'completed');

        // Generate final summary
        const summary = await this.generateSummary(args.sessionId, state);
        await stateManager.saveSummary({
          session_id: args.sessionId,
          summary_type: 'full',
          summary_text: summary,
          up_to_node: currentNode
        });

        return {
          response: finalResponse || 'All set! Is there anything else I can help with?',
          completed: true,
          agentLogs
        };
      }

      // Move to next node
      currentNode = nextNode;
      await stateManager.updateSession(args.sessionId, {
        current_node: currentNode,
        session_context: state
      });

      // If next node requires user confirmation, stop here
      const nextNodeDef = args.graph.nodes[nextNode];
      if (nextNodeDef?.requiresUserConfirmation) {
        return {
          response: finalResponse,
          nextNode: currentNode,
          requiresUserInput: true,
          agentLogs
        };
      }
    }

    // Max iterations reached
    return {
      response: finalResponse || 'Let\'s continue from where we left off.',
      nextNode: currentNode,
      requiresUserInput: true,
      agentLogs
    };
  }

  /**
   * Detect user intent from message
   * Uses simple keyword matching - in production, use LLM-based intent classification
   */
  private async detectIntent(message: string, state: Record<string, any>): Promise<IntentDetectionResult> {
    const lowerMessage = message.toLowerCase();

    // CalendarBooking intent keywords
    const bookingKeywords = [
      'book', 'booking', 'schedule', 'appointment', 'calendar',
      'visit', 'service', 'landscaping', 'hvac', 'plumbing',
      'electrical', 'contractor', 'when can', 'available'
    ];

    const hasBookingKeyword = bookingKeywords.some(keyword => lowerMessage.includes(keyword));

    if (hasBookingKeyword) {
      return {
        intent: 'CalendarBooking',
        confidence: 0.9,
        reasoning: 'Message contains booking/scheduling keywords'
      };
    }

    // Default to CalendarBooking for now (only implemented intent)
    return {
      intent: 'CalendarBooking',
      confidence: 0.5,
      reasoning: 'Default intent'
    };
  }

  /**
   * Generate conversation summary
   */
  private async generateSummary(sessionId: string, state: Record<string, any>): Promise<string> {
    const parts: string[] = [];

    if (state.customer_name) parts.push(`Customer: ${state.customer_name}`);
    if (state.service_category) parts.push(`Service: ${state.service_category}`);
    if (state.desired_date) parts.push(`Date: ${state.desired_date}`);
    if (state.selected_time) parts.push(`Time: ${state.selected_time}`);
    if (state.task_code) parts.push(`Booking: ${state.task_code}`);

    return parts.join(', ') || 'Conversation completed';
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<{
    session: any;
    state: Record<string, any>;
    logs: any[];
  }> {
    const session = await stateManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const state = await stateManager.getAllState(sessionId);
    const logs = await stateManager.getAgentLogs(sessionId, { limit: 50 });

    return { session, state, logs };
  }
}

// Export singleton instance
export const orchestratorService = new OrchestratorService();
