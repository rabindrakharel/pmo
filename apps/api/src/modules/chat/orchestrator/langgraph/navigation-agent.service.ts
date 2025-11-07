/**
 * Navigation Agent Service
 * LLM-based routing: Analyzes conversation context to decide navigation
 * Replaces hardcoded keyword detection with intelligent LLM analysis
 * @module orchestrator/langgraph/navigation-agent
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { LangGraphState } from './langgraph-state-graph.service.js';

/**
 * Navigation Analysis Result
 */
export interface NavigationAnalysis {
  issue_changed: boolean;
  issue_change_reason?: string;
  data_update_requested: boolean;
  data_field?: string;
  suggested_node: string;
  flags_to_reset: string[];
  preserve_customer_data: boolean;
  reasoning: string;
}

/**
 * Navigation Agent
 * Uses LLM to analyze context and make routing decisions
 */
export class NavigationAgent {
  /**
   * Analyze current state and determine navigation
   */
  async analyzeNavigation(
    currentNode: string,
    state: LangGraphState,
    lastUserMessage?: string
  ): Promise<NavigationAnalysis> {
    console.log(`\n[Navigation Agent] 🧭 Analyzing navigation from node: ${currentNode}`);

    const openaiService = getOpenAIService();

    // Build navigation analysis tool
    const navigationTool = this.buildNavigationTool();

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt();

    // Build user prompt with context
    const userPrompt = this.buildUserPrompt(currentNode, state, lastUserMessage);

    console.log(`[Navigation Agent] 🤖 Calling LLM for navigation analysis...`);

    try {
      const result = await openaiService.callAgent({
        agentType: 'planner',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        jsonMode: true,
      });

      // Parse JSON response
      const analysis = JSON.parse(result.content);

      console.log(`[Navigation Agent] ✅ Analysis complete:`);
      console.log(`  Issue Changed: ${analysis.issue_changed}`);
      console.log(`  Data Update: ${analysis.data_update_requested}`);
      console.log(`  Suggested Node: ${analysis.suggested_node}`);
      console.log(`  Reasoning: ${analysis.reasoning}`);

      return {
        issue_changed: analysis.issue_changed || false,
        issue_change_reason: analysis.issue_change_reason,
        data_update_requested: analysis.data_update_requested || false,
        data_field: analysis.data_field,
        suggested_node: analysis.suggested_node,
        flags_to_reset: analysis.flags_to_reset || [],
        preserve_customer_data: analysis.preserve_customer_data !== false,
        reasoning: analysis.reasoning,
      };
    } catch (error: any) {
      console.error(`[Navigation Agent] ❌ Error:`, error.message);
      return this.getFallbackAnalysis(currentNode);
    }
  }

  /**
   * Build navigation analysis tool for LLM
   */
  private buildNavigationTool(): any {
    return {
      type: 'function',
      function: {
        name: 'analyze_navigation',
        description: `Analyze the conversation context and determine navigation decisions.

You are the navigation intelligence for a customer service conversation system.
Analyze the current state and determine:
1. Has the customer changed their issue/request?
2. Is the customer asking to update specific data (phone, name, email)?
3. Which node should execute next?
4. Which flags should be reset?

Consider:
- Customer intent changes (e.g., "actually I need X instead")
- Data corrections (e.g., "my phone is actually...")
- Conversation flow progression
- Completed vs pending steps`,
        parameters: {
          type: 'object',
          properties: {
            issue_changed: {
              type: 'boolean',
              description: 'True if customer is changing their main issue/request. Look for intent shifts, not just clarifications.',
            },
            issue_change_reason: {
              type: 'string',
              description: 'If issue changed, explain what the customer said that indicates this.',
            },
            data_update_requested: {
              type: 'boolean',
              description: 'True if customer wants to update their personal data (phone, name, email, address).',
            },
            data_field: {
              type: 'string',
              enum: ['customer_phone_number', 'customer_name', 'customer_email', 'customer_address'],
              description: 'If data update requested, which field?',
            },
            suggested_node: {
              type: 'string',
              enum: [
                'I_greet_customer',
                'II_ask_about_need',
                'III_identify_issue',
                'IV_empathize',
                'V_build_rapport',
                'VI_gather_customer_data',
                'VII_check_existing_customer',
                'VIII_plan_actions',
                'IX_communicate_plan',
                'X_execute_plan',
                'XI_communicate_execution',
                'XIb_ask_another_request',
                'XII_goodbye',
                'END',
              ],
              description: 'Which node should execute next based on conversation state?',
            },
            flags_to_reset: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'issue_identified',
                  'empathized',
                  'rapport_built',
                  'phone_collected',
                  'name_collected',
                  'email_collected',
                  'address_collected',
                  'customer_checked',
                  'plan_created',
                  'plan_communicated',
                  'plan_executed',
                  'execution_communicated',
                ],
              },
              description: 'Which flags should be reset to allow re-execution? If issue changed, reset issue-related flags. If data update, reset specific data flag.',
            },
            preserve_customer_data: {
              type: 'boolean',
              description: 'Should we preserve customer data (name, phone, etc.) when resetting? Usually true unless starting completely fresh.',
            },
            reasoning: {
              type: 'string',
              description: 'Explain your navigation decision in 1-2 sentences.',
            },
          },
          required: ['issue_changed', 'data_update_requested', 'suggested_node', 'reasoning'],
        },
      },
    };
  }

  /**
   * Build system prompt for navigation agent
   */
  private buildSystemPrompt(): string {
    return `You are an intelligent navigation agent for a customer service conversation system.

Your job is to analyze the conversation context and make routing decisions.

Key Responsibilities:
1. Detect Issue Changes
   - Customer says they need something different than originally stated
   - NOT just clarifications or additional details about same issue
   - Examples: "actually I need plumbing" (after discussing landscaping)

2. Detect Data Updates
   - Customer corrects their phone, name, email, or address
   - Examples: "my phone is actually 555-1234", "call me John instead"

3. Determine Next Node
   - Based on conversation flow and completed steps
   - Consider which flags are already set
   - Route to appropriate next step

4. Determine Flag Resets
   - If issue changed: reset issue_identified, empathized, rapport_built, plan_created, plan_communicated, plan_executed, execution_communicated
   - If data updated: reset specific data flag (phone_collected, name_collected, etc.)
   - Preserve customer_checked flag unless completely starting over

5. Navigation Logic
   - If issue changed → route to III_identify_issue
   - If data update → route to VI_gather_customer_data
   - If waiting for user input → route to END
   - Otherwise → follow normal flow progression

Return your analysis as JSON with this exact structure:
{
  "issue_changed": boolean,
  "issue_change_reason": "string (if issue changed)",
  "data_update_requested": boolean,
  "data_field": "customer_phone_number|customer_name|customer_email|customer_address",
  "suggested_node": "node_name",
  "flags_to_reset": ["flag1", "flag2"],
  "preserve_customer_data": boolean,
  "reasoning": "string"
}

Available flags: issue_identified, empathized, rapport_built, phone_collected, name_collected, email_collected, address_collected, customer_checked, plan_created, plan_communicated, plan_executed, execution_communicated

Available nodes: I_greet_customer, II_ask_about_need, III_identify_issue, IV_empathize, V_build_rapport, VI_gather_customer_data, VII_check_existing_customer, VIII_plan_actions, IX_communicate_plan, X_execute_plan, XI_communicate_execution, XIb_ask_another_request, XII_goodbye, END`;
  }

  /**
   * Build user prompt with current context
   */
  private buildUserPrompt(
    currentNode: string,
    state: LangGraphState,
    lastUserMessage?: string
  ): string {
    const context = state.context || {};
    const progressFlags = state.progress_flags || {};

    // Get recent messages
    const recentMessages = state.messages
      .slice(-5)
      .map((msg) => {
        const role = msg._getType() === 'human' ? 'Customer' : 'Agent';
        return `${role}: ${msg.content.toString()}`;
      })
      .join('\n');

    // Build context summary
    const contextSummary = {
      current_issue: context.customers_main_ask || '(not set)',
      customer_phone: context.customer_phone_number || '(not set)',
      customer_name: context.customer_name || '(not set)',
      customer_email: context.customer_email || '(not set)',
      service_catalog: context.matching_service_catalog_to_solve_customers_issue || '(not set)',
      plan_steps: context.next_steps_plan || [],
    };

    // Build flags summary
    const completedSteps = Object.entries(progressFlags)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => key)
      .join(', ');

    return `Current Node: ${currentNode}

Recent Conversation:
${recentMessages}

${lastUserMessage ? `Latest User Message: "${lastUserMessage}"\n` : ''}
Context State:
${JSON.stringify(contextSummary, null, 2)}

Completed Steps (flags set): ${completedSteps || 'none'}

Analyze this conversation state and determine:
1. Has the customer changed their main issue/request?
2. Is the customer asking to update personal data?
3. Which node should we route to next?
4. Which flags (if any) should be reset?

Use the analyze_navigation tool to provide your analysis.`;
  }

  /**
   * Fallback analysis if LLM fails
   */
  private getFallbackAnalysis(currentNode: string): NavigationAnalysis {
    console.warn(`[Navigation Agent] ⚠️  Using fallback analysis`);

    return {
      issue_changed: false,
      data_update_requested: false,
      suggested_node: 'END',
      flags_to_reset: [],
      preserve_customer_data: true,
      reasoning: 'Fallback: No changes detected, waiting for user input',
    };
  }
}

/**
 * Singleton instance
 */
let instance: NavigationAgent | null = null;

export function getNavigationAgent(): NavigationAgent {
  if (!instance) {
    instance = new NavigationAgent();
  }
  return instance;
}
