/**
 * Worker Reply Agent
 * Generates customer-facing responses ONLY
 * Responsibilities:
 * - Read conversation context
 * - Understand node role, goal, and prompt examples
 * - Reply in 1-2 natural sentences
 * - NO context extraction (handled by DataExtractionAgent)
 * @module orchestrator/agents/worker-reply-agent
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { DAGConfiguration, DAGContext } from './dag-types.js';

/**
 * Worker Reply Agent Result
 */
export interface WorkerReplyResult {
  response: string;
}

/**
 * Worker Reply Agent Service
 * Role: Generate natural customer responses based on node prompts
 */
export class WorkerReplyAgent {
  private dagConfig: DAGConfiguration;

  constructor(dagConfig: DAGConfiguration) {
    this.dagConfig = dagConfig;
  }

  /**
   * Execute node: Generate customer response ONLY
   * Context extraction is handled by DataExtractionAgent after this completes
   */
  async executeNode(
    nodeName: string,
    state: AgentContextState,
    userMessage?: string
  ): Promise<WorkerReplyResult> {
    console.log(`\n🗣️  [WorkerReplyAgent] Executing node: ${nodeName}`);

    // Get node configuration
    const node = this.dagConfig.nodes.find(n => n.node_name === nodeName);
    if (!node) {
      throw new Error(`Node not found in DAG: ${nodeName}`);
    }

    // Build prompts using node's configuration
    // ✅ FIX: Pass current user message to buildSystemPrompt to ensure it's included
    const systemPrompt = this.buildSystemPrompt(node, state.context, userMessage);
    const userPrompt = this.buildUserPrompt(node, state.context, userMessage);

    console.log(`[WorkerReplyAgent] Node Goal: ${node.node_goal}`);

    // Call LLM to generate customer response (NO tools - just response)
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      sessionId: state.sessionId,
      // NO tools parameter - this agent only generates responses
    });

    const response = result.content || '';

    console.log(`[WorkerReplyAgent] ✅ Generated response (${response.length} chars)`);

    return {
      response,
    };
  }

  /**
   * Build system prompt for customer-facing response
   * OPTIMIZED: Only passes role, goal, prompt example, and actively tracked context fields
   * ✅ FIX: Now includes current user message to prevent stale context issues
   */
  private buildSystemPrompt(node: any, context: DAGContext, currentUserMessage?: string): string {
    // Node provides role and goal (business operation state)
    const nodeRole = node.node_role || node.role || 'a customer service agent';
    const nodeGoal = node.node_goal || '';
    const exampleTone = node.example_tone_of_reply || '';

    // CRITICAL: Only last 3 conversation exchanges (not all 255!)
    // Reduced from 5 to 3 to leave more room for current message context
    const recentConversation = (context.summary_of_conversation_on_each_step_until_now || []).slice(-3);

    // Format ONLY actively tracked context fields (mandatory + non-empty fields)
    const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || ['customers_main_ask', 'customer_phone_number'];
    const activeContext: Record<string, any> = {
      recent_conversation: recentConversation,
      flags: context.flags || {}
    };

    for (const field of mandatoryFields) {
      if (context[field]) activeContext[field] = context[field];
    }

    const trackingFields = ['customer_name', 'customer_id', 'task_id', 'appointment_details', 'matching_service_catalog_to_solve_customers_issue'];
    for (const field of trackingFields) {
      if (context[field] && context[field] !== '' && context[field] !== '(not set)') {
        activeContext[field] = context[field];
      }
    }

    // ✅ FIX: Build comprehensive context including current message
    let prompt = `NODE ROLE: ${nodeRole}

NODE GOAL: ${nodeGoal}

EXAMPLE TONE/STYLE OF REPLY:
${exampleTone}

RECENT CONVERSATION HISTORY (last 3 exchanges):
${recentConversation.map((ex: any) => `Customer: "${ex.customer}"\nAgent: "${ex.agent}"`).join('\n\n')}

CURRENT CONTEXT (fields already populated):
${JSON.stringify(activeContext, null, 2)}`;

    // ✅ CRITICAL: Include current user message if available
    if (currentUserMessage) {
      prompt += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 CURRENT CUSTOMER MESSAGE (MOST IMPORTANT - RESPOND TO THIS):
"${currentUserMessage}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    prompt += `

RESPONSE GENERATION RULES:
- Review CURRENT CUSTOMER MESSAGE first (most important!)
- Check recent_conversation to avoid repetition
- NEVER ask questions already answered
- Generate natural 1-2 sentence response ONLY
- NO technical details, JSON, or metadata in customer-facing response
- Focus ONLY on generating helpful, empathetic customer response
- Base your response on the CURRENT message, not old conversation

Please generate appropriate response to the CURRENT customer message:`;

    return prompt;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(node: any, context: DAGContext, userMessage?: string): string {
    let prompt = `Node: ${node.node_name}\nGoal: ${node.node_goal}\n`;

    if (userMessage) {
      prompt += `\nUser said: "${userMessage}"\n`;
    }

    prompt += `\nGenerate a natural, empathetic response (1-2 sentences):`;

    return prompt;
  }
}

/**
 * Create worker reply agent instance
 */
export function createWorkerReplyAgent(dagConfig: DAGConfiguration): WorkerReplyAgent {
  return new WorkerReplyAgent(dagConfig);
}
