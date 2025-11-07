/**
 * Pure LLM-Driven Orchestrator
 * No LangChain, No LangGraph - Pure context-driven conversation system
 * Uses three agents (Navigator, Worker, Guider) to drive everything
 * @module orchestrator/langgraph/pure-llm-orchestrator
 */

import { getAgentProfiles } from './agent-profiles.service.js';
import { getContextManager } from './context-manager.service.js';
import { getNodeExecutor } from './node-executor.service.js';
import type { ConversationContext } from './context-manager.service.js';
import type { NodeExecutionResult } from './node-executor.service.js';

/**
 * Orchestrator Response
 */
export interface OrchestratorResponse {
  response: string;
  context: ConversationContext;
  conversation_ended: boolean;
  end_reason?: string;
}

/**
 * Pure LLM Orchestrator
 * Context-driven conversation flow with three LLM agents
 */
export class PureLLMOrchestrator {
  private agentProfiles = getAgentProfiles();
  private contextManager = getContextManager();
  private nodeExecutor = getNodeExecutor();

  /**
   * Process user message (main entry point)
   */
  async processMessage(sessionId: string, userMessage: string): Promise<OrchestratorResponse> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[PureLLMOrchestrator] 🎬 Processing message for session: ${sessionId}`);
    console.log(`[PureLLMOrchestrator] 💬 User: ${userMessage}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      // 1. Load or create context
      let context = await this.contextManager.getOrCreateContext(sessionId);

      // Check if conversation already ended
      if (context.conversation_ended) {
        console.log(`[PureLLMOrchestrator] 🏁 Conversation already ended`);
        return {
          response: "This conversation has ended. Please start a new conversation.",
          context,
          conversation_ended: true,
          end_reason: context.end_reason,
        };
      }

      // 2. Add user message to context
      context = await this.contextManager.addUserMessage(sessionId, userMessage);

      // 3. Use Navigator Agent to determine which node to execute
      console.log(`\n[PureLLMOrchestrator] 🧭 Calling Navigator Agent...`);
      const navigationDecision = await this.agentProfiles.navigateNextNode(
        this.buildContextForNavigator(context),
        userMessage,
        this.contextManager.getAvailableNodes()
      );

      console.log(`[PureLLMOrchestrator] ✅ Navigator Decision: ${navigationDecision.next_node}`);
      console.log(`[PureLLMOrchestrator] 📝 Reasoning: ${navigationDecision.reasoning}`);

      // 4. Apply flag updates from Navigator
      if (Object.keys(navigationDecision.flags_to_update).length > 0) {
        context = await this.contextManager.updateFlags(sessionId, navigationDecision.flags_to_update);
      }

      // 5. Check if Navigator wants to skip current node
      if (navigationDecision.skip_current_node) {
        console.log(`[PureLLMOrchestrator] ⏭️  Navigator says skip current node`);
        // Navigator will handle routing to correct node
      }

      // 6. Determine next node to execute
      const nextNode = navigationDecision.next_node;

      // Check if END (wait for user)
      if (nextNode === 'END') {
        console.log(`[PureLLMOrchestrator] ⏸️  Waiting for user input`);
        return {
          response: '',
          context,
          conversation_ended: false,
        };
      }

      // 7. Execute node chain until we need to wait for user
      let accumulatedResponse = '';
      let currentNode = nextNode;
      let maxIterations = 10; // Prevent infinite loops
      let iterations = 0;

      while (iterations < maxIterations) {
        iterations++;

        console.log(`\n[PureLLMOrchestrator] ⚙️  Iteration ${iterations}: Executing node ${currentNode}`);

        // Execute node
        const { context: updatedContext, result } = await this.nodeExecutor.executeAndApply(
          sessionId,
          currentNode,
          context,
          userMessage
        );

        context = updatedContext;

        // Accumulate response
        if (result.response) {
          accumulatedResponse += result.response;
        }

        // Check if we should wait for user
        if (result.should_wait_for_user) {
          console.log(`[PureLLMOrchestrator] ⏸️  Node ${currentNode} requires user input`);

          // Use Guider Agent to check conversation quality
          await this.runGuidanceCheck(context, currentNode);

          break;
        }

        // Use Navigator Agent to decide next node
        console.log(`\n[PureLLMOrchestrator] 🧭 Calling Navigator for next node...`);
        const nextNavigation = await this.agentProfiles.navigateNextNode(
          this.buildContextForNavigator(context),
          undefined,
          this.contextManager.getAvailableNodes()
        );

        console.log(`[PureLLMOrchestrator] ✅ Navigator Decision: ${nextNavigation.next_node}`);

        // Apply flag updates
        if (Object.keys(nextNavigation.flags_to_update).length > 0) {
          context = await this.contextManager.updateFlags(sessionId, nextNavigation.flags_to_update);
        }

        // Check if END
        if (nextNavigation.next_node === 'END') {
          console.log(`[PureLLMOrchestrator] ⏸️  Navigator says wait for user`);
          break;
        }

        // Check if GOODBYE (end conversation)
        if (nextNavigation.next_node === 'XII_goodbye') {
          console.log(`[PureLLMOrchestrator] 👋 Conversation ending...`);

          // Execute goodbye node
          const { context: finalContext, result: goodbyeResult } = await this.nodeExecutor.executeAndApply(
            sessionId,
            'XII_goodbye',
            context,
            userMessage
          );

          context = finalContext;
          accumulatedResponse += goodbyeResult.response;

          // End conversation
          context = await this.contextManager.endConversation(sessionId, 'Normal completion');

          return {
            response: accumulatedResponse,
            context,
            conversation_ended: true,
            end_reason: 'Normal completion',
          };
        }

        // Continue to next node
        currentNode = nextNavigation.next_node;
      }

      // Check for infinite loop
      if (iterations >= maxIterations) {
        console.error(`[PureLLMOrchestrator] ⚠️  Max iterations reached! Possible infinite loop.`);
        accumulatedResponse += "\n\nI apologize, but I need a moment to process. Can you please rephrase your request?";
      }

      // Update conversation summary
      if (accumulatedResponse) {
        await this.contextManager.updateSummary(sessionId, userMessage, accumulatedResponse);
      }

      console.log(`\n[PureLLMOrchestrator] ✅ Processing complete`);
      console.log(`[PureLLMOrchestrator] 📍 Current node: ${context.current_node}`);
      console.log(`[PureLLMOrchestrator] 🎯 Traversal: ${context.node_traversal_path.join(' → ')}`);
      console.log(`${'='.repeat(80)}\n`);

      return {
        response: accumulatedResponse,
        context,
        conversation_ended: false,
      };
    } catch (error: any) {
      console.error(`[PureLLMOrchestrator] ❌ Error processing message:`, error.message);

      // Load context for error response
      const context = await this.contextManager.loadContext(sessionId);

      return {
        response: 'I apologize, but I encountered an issue. How can I assist you?',
        context: context || ({} as any),
        conversation_ended: false,
      };
    }
  }

  /**
   * Build context for Navigator Agent
   */
  private buildContextForNavigator(context: ConversationContext): Record<string, any> {
    return {
      // Core fields
      customers_main_ask: context.customers_main_ask,
      customer_phone_number: context.customer_phone_number,
      customer_name: context.customer_name,
      customer_email: context.customer_email,
      customer_id: context.customer_id,
      matching_service_catalog_to_solve_customers_issue:
        context.matching_service_catalog_to_solve_customers_issue,
      task_id: context.task_id,
      appointment_details: context.appointment_details,
      next_steps_plan: context.next_steps_plan,
      execution_results: context.execution_results,

      // Navigation state
      current_node: context.current_node,
      node_traversal_path: context.node_traversal_path,

      // Flags
      flags: context.flags,

      // Recent conversation
      recent_messages: this.contextManager.getRecentMessages(context, 5),

      // Metadata
      conversation_ended: context.conversation_ended,
    };
  }

  /**
   * Run Guider Agent to check conversation quality
   */
  private async runGuidanceCheck(context: ConversationContext, currentNode: string): Promise<void> {
    console.log(`\n[PureLLMOrchestrator] 🎯 Running Guider Agent for quality check...`);

    try {
      const guidanceCheck = await this.agentProfiles.checkGuidance(
        this.buildContextForNavigator(context),
        context.summary_of_conversation_on_each_step_until_now,
        currentNode
      );

      if (guidanceCheck.is_on_track) {
        console.log(`[PureLLMOrchestrator] ✅ Guider: Conversation is on track`);
        console.log(`[PureLLMOrchestrator] 📝 Reasoning: ${guidanceCheck.reasoning}`);
      } else {
        console.log(`[PureLLMOrchestrator] ⚠️  Guider: Conversation is OFF TRACK`);
        console.log(`[PureLLMOrchestrator] 📝 Reasoning: ${guidanceCheck.reasoning}`);
        if (guidanceCheck.suggested_correction) {
          console.log(`[PureLLMOrchestrator] 💡 Suggested Correction: ${guidanceCheck.suggested_correction}`);
        }
      }
    } catch (error: any) {
      console.error(`[PureLLMOrchestrator] ❌ Guider Agent error:`, error.message);
      // Continue even if guider fails (it's for quality monitoring only)
    }
  }

  /**
   * Get conversation context (for external access)
   */
  async getContext(sessionId: string): Promise<ConversationContext | null> {
    return await this.contextManager.loadContext(sessionId);
  }

  /**
   * Reset conversation (start fresh)
   */
  async resetConversation(sessionId: string): Promise<ConversationContext> {
    console.log(`[PureLLMOrchestrator] 🔄 Resetting conversation: ${sessionId}`);

    // Create fresh context
    return await this.contextManager.createContext(sessionId);
  }
}

/**
 * Singleton instance
 */
let instance: PureLLMOrchestrator | null = null;

export function getPureLLMOrchestrator(): PureLLMOrchestrator {
  if (!instance) {
    instance = new PureLLMOrchestrator();
  }
  return instance;
}
