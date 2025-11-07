/**
 * DAG LLM Router Service
 * LLM-driven routing: Ask LLM to analyze context and decide next node
 * Replaces keyword-based routing with LLM inference
 * @module orchestrator/langgraph/dag-llm-router
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { DAGContext, DAGConfiguration, RoutingDecision } from './dag-types.js';
import { buildRoutingDecisionTool } from './dag-context-tools.service.js';

/**
 * LLM-Based Router
 * Uses LLM to analyze context and determine next node
 */
export class DAGLLMRouter {
  private dagConfig: DAGConfiguration;

  constructor(dagConfig: DAGConfiguration) {
    this.dagConfig = dagConfig;
  }

  /**
   * Ask LLM to decide next node based on context analysis
   */
  async decideNextNode(
    currentNode: string,
    context: DAGContext,
    lastUserMessage?: string
  ): Promise<RoutingDecision> {
    console.log(`\n[LLM Router] 🤔 Analyzing context to decide next node from: ${currentNode}`);

    const openaiService = getOpenAIService();

    // Build system prompt with full context
    const systemPrompt = this.buildRouterSystemPrompt();

    // Build user prompt with current state
    const userPrompt = this.buildRouterUserPrompt(currentNode, context, lastUserMessage);

    console.log(`[LLM Router] 🧠 Calling LLM with routing tool...`);

    try {
      // Build routing tool from dag.json (all knowledge from config)
      const routingTool = buildRoutingDecisionTool(this.dagConfig);

      // Call LLM with routing decision tool
      const result = await openaiService.callAgent({
        agentType: 'planner',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [routingTool],
        tool_choice: { type: 'function', function: { name: 'decide_next_node' } },
        temperature: 0.1,
      });

      // Extract tool call
      if (result.tool_calls && result.tool_calls.length > 0) {
        const toolCall = result.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`[LLM Router] ✅ Decision: ${args.next_node}`);
        console.log(`[LLM Router] 📝 Reason: ${args.reason}`);
        if (args.skip_reason) {
          console.log(`[LLM Router] ⏭️  Skip Reason: ${args.skip_reason}`);
        }

        return {
          next_node: args.next_node,
          reason: args.reason,
          skip_current: args.skip_reason ? true : false,
        };
      }

      // Fallback if no tool call
      console.warn(`[LLM Router] ⚠️  No tool call, using fallback routing`);
      return this.getFallbackRouting(currentNode, context);
    } catch (error: any) {
      console.error(`[LLM Router] ❌ Error in LLM routing:`, error.message);
      return this.getFallbackRouting(currentNode, context);
    }
  }

  /**
   * Build system prompt for router LLM
   */
  private buildRouterSystemPrompt(): string {
    return `You are an intelligent conversation flow router for a customer service system.

Your job is to analyze the conversation context and decide which node should execute next.

Core Principles:
1. Skip nodes if their flag is already set to 1 (step completed)
2. If customer changes their issue, reset issue-related flags and route to Identify_Issue
3. If customer wants to update data (phone, name), reset that specific data flag and route to Try_To_Gather_Customers_Data
4. Prioritize collecting mandatory fields: customers_main_ask and customer_phone_number
5. Use END when waiting for user response
6. Follow logical flow: greeting → identify issue → empathize → gather data → check customer → plan → execute → goodbye

Node Flow:
GREET_CUSTOMER → ASK_CUSTOMER_ABOUT_THEIR_NEED → Identify_Issue → use_mcp_to_get_info →
Empathize → Console_Build_Rapport → Try_To_Gather_Customers_Data → Check_IF_existing_customer →
Plan → Communicate_To_Customer_Before_Action → Execute_Plan_Using_MCP → Tell_Customers_Execution →
Goodbye_And_Hangup

Special Cases:
- Issue change (keywords: "actually", "instead", "wait", "different issue") → Identify_Issue
- Data update (keywords: "change phone", "update name") → Try_To_Gather_Customers_Data
- No consent on plan → Plan (re-plan)
- Customer has another request after completion → ASK_CUSTOMER_ABOUT_THEIR_NEED

Use the decide_next_node tool to make your decision.`;
  }

  /**
   * Build user prompt with current state
   */
  private buildRouterUserPrompt(
    currentNode: string,
    context: DAGContext,
    lastUserMessage?: string
  ): string {
    // Build context summary
    const contextSummary = {
      flags: context.flags || {},
      customers_main_ask: context.customers_main_ask || '(not set)',
      customer_phone_number: context.customer_phone_number || '(not set)',
      customer_name: context.customer_name || '(not set)',
      customer_id: context.customer_id || '(not set)',
      service_catalog: context.matching_service_catalog_to_solve_customers_issue || '(not set)',
      task_id: context.task_id || '(not set)',
      plan: context.next_steps_plans_help_customer || '(not set)',
      execution_results: context.execution_results || '(not set)',
    };

    return `Current Node: ${currentNode}
${lastUserMessage ? `Last User Message: "${lastUserMessage}"\n` : ''}
Context State:
${JSON.stringify(contextSummary, null, 2)}

Analyze the context and decide which node should execute next. Consider:
1. Which steps are already complete (flags = 1)?
2. Are mandatory fields set (customers_main_ask, customer_phone_number)?
3. Did the user indicate an issue change or data update?
4. Is the conversation flow progressing logically?
5. Should we wait for user input (return END)?

Use the decide_next_node tool to return your decision.`;
  }

  /**
   * Fallback routing if LLM fails
   */
  private getFallbackRouting(currentNode: string, context: DAGContext): RoutingDecision {
    const flags = context.flags || {};

    // Simple rule-based fallback
    if (!flags.greet_flag) {
      return {
        next_node: 'GREET_CUSTOMER',
        reason: 'Fallback: need to greet',
        skip_current: false,
      };
    }

    if (!flags.ask_need_flag) {
      return {
        next_node: 'ASK_CUSTOMER_ABOUT_THEIR_NEED',
        reason: 'Fallback: need to ask about need',
        skip_current: false,
      };
    }

    if (!flags.identify_issue_flag || !context.customers_main_ask) {
      return {
        next_node: 'Identify_Issue',
        reason: 'Fallback: need to identify issue',
        skip_current: false,
      };
    }

    if (!flags.empathize_flag) {
      return {
        next_node: 'Empathize',
        reason: 'Fallback: need to empathize',
        skip_current: false,
      };
    }

    if (!flags.data_phone_flag || !context.customer_phone_number) {
      return {
        next_node: 'Try_To_Gather_Customers_Data',
        reason: 'Fallback: need to gather customer data',
        skip_current: false,
      };
    }

    // Default to END (wait for user)
    return {
      next_node: 'END',
      reason: 'Fallback: wait for user input',
      skip_current: false,
    };
  }

  /**
   * Check if current node should be skipped based on context
   */
  shouldSkipNode(nodeName: string, context: DAGContext): boolean {
    const flags = context.flags || {};

    // Map nodes to their flags
    const nodeFlagMap: Record<string, string> = {
      GREET_CUSTOMER: 'greet_flag',
      ASK_CUSTOMER_ABOUT_THEIR_NEED: 'ask_need_flag',
      Identify_Issue: 'identify_issue_flag',
      Empathize: 'empathize_flag',
      Console_Build_Rapport: 'rapport_flag',
      Try_To_Gather_Customers_Data: 'data_phone_flag', // Check if data collection complete
      Check_IF_existing_customer: 'check_customer_flag',
      Plan: 'plan_flag',
      Communicate_To_Customer_Before_Action: 'communicate_plan_flag',
      Execute_Plan_Using_MCP: 'execute_flag',
      Tell_Customers_Execution: 'tell_execution_flag',
      Goodbye_And_Hangup: 'goodbye_flag',
    };

    const flagName = nodeFlagMap[nodeName];
    if (flagName) {
      const skip = flags[flagName] === 1;
      if (skip) {
        console.log(`[LLM Router] ⏭️  Skipping ${nodeName} (${flagName} = 1)`);
      }
      return skip;
    }

    return false;
  }
}

/**
 * Singleton accessor
 */
let routerInstance: DAGLLMRouter | null = null;

export function getDAGLLMRouter(dagConfig: DAGConfiguration): DAGLLMRouter {
  if (!routerInstance) {
    routerInstance = new DAGLLMRouter(dagConfig);
  }
  return routerInstance;
}
