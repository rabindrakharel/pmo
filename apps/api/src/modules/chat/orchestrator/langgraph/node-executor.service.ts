/**
 * Dynamic Node Executor Service
 * Executes nodes dynamically using dag.json definitions (no hardcoded nodes)
 * Uses Worker Agent to process node prompts and update context
 * @module orchestrator/langgraph/node-executor
 */

import { getAgentProfiles } from './agent-profiles.service.js';
import { getContextManager } from './context-manager.service.js';
import type { ConversationContext } from './context-manager.service.js';
import type { DAGNode } from './dag-types.js';

/**
 * Node Execution Result
 */
export interface NodeExecutionResult {
  response: string;
  context_updates: Record<string, any>;
  flag_updates: Record<string, number>;
  should_wait_for_user: boolean;
  error?: string;
}

/**
 * Dynamic Node Executor
 * Executes any node based on dag.json definition
 */
export class NodeExecutor {
  private agentProfiles = getAgentProfiles();
  private contextManager = getContextManager();

  /**
   * Execute a node dynamically
   */
  async executeNode(
    nodeName: string,
    context: ConversationContext,
    userMessage?: string
  ): Promise<NodeExecutionResult> {
    console.log(`\n[NodeExecutor] ⚙️  Executing node: ${nodeName}`);

    try {
      // Get node definition from dag.json
      const nodeDefinition = this.contextManager.getNodeDefinition(nodeName);

      if (!nodeDefinition) {
        console.error(`[NodeExecutor] ❌ Node not found in dag.json: ${nodeName}`);
        return {
          response: 'I apologize, but I encountered an issue processing your request.',
          context_updates: {},
          flag_updates: {},
          should_wait_for_user: true,
          error: `Node not found: ${nodeName}`,
        };
      }

      // Check if node should be skipped (flag already set)
      if (this.shouldSkipNode(nodeName, context)) {
        console.log(`[NodeExecutor] ⏭️  Skipping node ${nodeName} (already completed)`);
        return {
          response: '',
          context_updates: {},
          flag_updates: {},
          should_wait_for_user: false,
        };
      }

      // Use Worker Agent to process the node
      console.log(`[NodeExecutor] 💼 Calling Worker Agent for node: ${nodeName}`);

      const workerResult = await this.agentProfiles.processWork(
        nodeDefinition.prompt,
        nodeDefinition.node_goal,
        this.buildContextForWorker(context),
        userMessage
      );

      console.log(`[NodeExecutor] ✅ Worker completed node: ${nodeName}`);
      console.log(`[NodeExecutor] 📝 Response: ${workerResult.response.substring(0, 100)}...`);
      console.log(`[NodeExecutor] 🔄 Context updates:`, Object.keys(workerResult.context_updates || {}));
      console.log(`[NodeExecutor] 🚩 Flag updates:`, workerResult.flag_updates);

      // Determine if we should wait for user input
      const shouldWait = this.shouldWaitForUser(nodeName, workerResult);

      return {
        response: workerResult.response,
        context_updates: workerResult.context_updates,
        flag_updates: workerResult.flag_updates,
        should_wait_for_user: shouldWait,
      };
    } catch (error: any) {
      console.error(`[NodeExecutor] ❌ Error executing node ${nodeName}:`, error.message);

      return {
        response: 'I apologize, but I encountered an issue. How can I assist you?',
        context_updates: {},
        flag_updates: {},
        should_wait_for_user: true,
        error: error.message,
      };
    }
  }

  /**
   * Build context object for Worker Agent
   * Convert ConversationContext to plain object for LLM
   */
  private buildContextForWorker(context: ConversationContext): Record<string, any> {
    return {
      // Core fields
      who_are_you: context.who_are_you,
      customers_main_ask: context.customers_main_ask,
      customer_phone_number: context.customer_phone_number,
      customer_name: context.customer_name,
      customer_email: context.customer_email,
      customer_address: context.customer_address,
      customer_id: context.customer_id,
      matching_service_catalog_to_solve_customers_issue:
        context.matching_service_catalog_to_solve_customers_issue,
      related_entities_for_customers_ask: context.related_entities_for_customers_ask,
      task_id: context.task_id,
      appointment_details: context.appointment_details,
      next_steps_plan: context.next_steps_plan,
      execution_results: context.execution_results,

      // Navigation
      current_node: context.current_node,
      node_traversal_path: context.node_traversal_path,

      // Flags
      flags: context.flags,

      // Recent conversation
      recent_messages: this.contextManager.getRecentMessages(context, 5),
      summary: context.summary_of_conversation_on_each_step_until_now.slice(-3),
    };
  }

  /**
   * Check if node should be skipped based on flags
   */
  private shouldSkipNode(nodeName: string, context: ConversationContext): boolean {
    // Map node names to their completion flags
    const nodeFlagMap: Record<string, string> = {
      I_greet_customer: 'greet_flag',
      II_ask_about_need: 'ask_need_flag',
      III_identify_issue: 'identify_issue_flag',
      IV_empathize: 'empathize_flag',
      V_build_rapport: 'rapport_flag',
      VI_gather_customer_data: 'data_phone_flag',
      VII_check_existing_customer: 'check_customer_flag',
      VIII_plan_actions: 'plan_flag',
      IX_communicate_plan: 'communicate_plan_flag',
      X_execute_plan: 'execute_flag',
      XI_communicate_execution: 'tell_execution_flag',
      XII_goodbye: 'goodbye_flag',
    };

    const flagName = nodeFlagMap[nodeName];
    if (flagName && context.flags[flagName] === 1) {
      return true;
    }

    return false;
  }

  /**
   * Determine if we should wait for user input after this node
   */
  private shouldWaitForUser(nodeName: string, workerResult: any): boolean {
    // Nodes that always wait for user input
    const waitNodes = [
      'I_greet_customer',
      'II_ask_about_need',
      'III_identify_issue',
      'VI_gather_customer_data',
      'IX_communicate_plan',
      'XI_communicate_execution',
      'XIb_ask_another_request',
      'XII_goodbye',
    ];

    if (waitNodes.includes(nodeName)) {
      return true;
    }

    // If worker generated a question or request, wait for user
    const response = workerResult.response?.toLowerCase() || '';
    if (response.includes('?') || response.includes('can you') || response.includes('please')) {
      return true;
    }

    // Otherwise, continue to next node
    return false;
  }

  /**
   * Apply node execution results to context
   */
  async applyNodeResults(
    sessionId: string,
    nodeName: string,
    result: NodeExecutionResult
  ): Promise<ConversationContext> {
    console.log(`[NodeExecutor] 📥 Applying node results to context`);

    // Update context fields
    if (Object.keys(result.context_updates).length > 0) {
      await this.contextManager.updateContextFields(sessionId, result.context_updates);
    }

    // Update flags
    if (Object.keys(result.flag_updates).length > 0) {
      await this.contextManager.updateFlags(sessionId, result.flag_updates);
    }

    // Add to traversal path
    await this.contextManager.addNodeToTraversal(sessionId, nodeName);

    // Add agent response to messages
    if (result.response) {
      await this.contextManager.addAgentMessage(sessionId, result.response);
    }

    // Get updated context
    const updatedContext = await this.contextManager.loadContext(sessionId);

    console.log(`[NodeExecutor] ✅ Node results applied to context`);
    return updatedContext!;
  }

  /**
   * Execute node and apply results (convenience method)
   */
  async executeAndApply(
    sessionId: string,
    nodeName: string,
    context: ConversationContext,
    userMessage?: string
  ): Promise<{ context: ConversationContext; result: NodeExecutionResult }> {
    // Execute node
    const result = await this.executeNode(nodeName, context, userMessage);

    // Apply results to context
    const updatedContext = await this.applyNodeResults(sessionId, nodeName, result);

    return { context: updatedContext, result };
  }
}

/**
 * Singleton instance
 */
let instance: NodeExecutor | null = null;

export function getNodeExecutor(): NodeExecutor {
  if (!instance) {
    instance = new NodeExecutor();
  }
  return instance;
}
