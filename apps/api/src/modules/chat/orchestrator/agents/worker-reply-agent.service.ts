/**
 * Worker Reply Agent
 * Generates customer-facing responses AND updates context
 * Responsibilities:
 * - Read conversation context
 * - Understand node role, goal, and prompt examples
 * - Reply in 1-2 natural sentences
 * - Call updateContext tool to extract customer data from conversation
 * @module orchestrator/agents/worker-reply-agent
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { DAGConfiguration, DAGContext } from './dag-types.js';
import { getLocalTools, executeUpdateContext } from '../tools/local-tools.js';

/**
 * Worker Reply Agent Result
 */
export interface WorkerReplyResult {
  response: string;
  contextUpdates?: Record<string, any>;
  fieldsUpdated?: string[];
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
   * Execute node: Generate customer response AND update context
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
    const systemPrompt = this.buildSystemPrompt(node, state.context);
    const userPrompt = this.buildUserPrompt(node, state.context, userMessage);

    console.log(`[WorkerReplyAgent] Node Goal: ${node.node_goal}`);

    // Get local tools for context updates
    const localTools = getLocalTools();

    // Call LLM to generate customer response (with tool access)
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      sessionId: state.sessionId,
      tools: localTools, // Give LLM access to updateContext tool
    });

    const response = result.content || '';
    let contextUpdates: Record<string, any> = {};
    let fieldsUpdated: string[] = [];

    // Handle tool calls if LLM made any
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log(`[WorkerReplyAgent] 🔧 LLM called ${result.toolCalls.length} tool(s)`);

      for (const toolCall of result.toolCalls) {
        if (toolCall.function.name === 'updateContext') {
          console.log(`[WorkerReplyAgent] ⚙️  Executing updateContext tool...`);

          // Parse tool arguments
          let toolArgs = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            console.error(`[WorkerReplyAgent] ❌ Failed to parse tool arguments:`, error);
            continue;
          }

          // Execute the updateContext tool
          const toolResult = await executeUpdateContext(state, toolArgs);

          if (toolResult.success) {
            contextUpdates = { ...contextUpdates, ...toolResult.updates };
            fieldsUpdated = [...new Set([...fieldsUpdated, ...toolResult.fieldsUpdated])];
          }
        }
      }
    }

    console.log(`[WorkerReplyAgent] ✅ Generated response (${response.length} chars)`);
    if (fieldsUpdated.length > 0) {
      console.log(`[WorkerReplyAgent] 📝 Context updates: ${fieldsUpdated.join(', ')}`);
    }

    return {
      response,
      contextUpdates: fieldsUpdated.length > 0 ? contextUpdates : undefined,
      fieldsUpdated: fieldsUpdated.length > 0 ? fieldsUpdated : undefined,
    };
  }

  /**
   * Build system prompt for customer-facing response
   * OPTIMIZED: Only passes role, goal, prompt example, and actively tracked context fields
   */
  private buildSystemPrompt(node: any, context: DAGContext): string {
    // Node provides role and goal (business operation state)
    const nodeRole = node.node_role || node.role || 'a customer service agent';
    const nodeGoal = node.node_goal || '';
    const exampleTone = node.example_tone_of_reply || '';

    // CRITICAL: Only last 5 conversation exchanges (not all 255!)
    const recentConversation = (context.summary_of_conversation_on_each_step_until_now || []).slice(-5);

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

    // Get last 4 conversation exchanges for context analysis
    const last4Exchanges = recentConversation.slice(-4);

    // Identify which context fields are NOT yet populated
    const allContextFields = ['customer_name', 'customer_phone_number', 'customer_email', 'customers_main_ask', 'matching_service_catalog_to_solve_customers_issue'];
    const emptyFields = allContextFields.filter(field => !context[field] || context[field] === '');

    return `NODE ROLE: ${nodeRole}

NODE GOAL: ${nodeGoal}

EXAMPLE TONE/STYLE OF REPLY:
${exampleTone}

CURRENT CONTEXT (fields already populated):
${JSON.stringify(activeContext, null, 2)}

EMPTY CONTEXT FIELDS (not yet extracted):
${emptyFields.join(', ')}

LAST 4 CONVERSATION EXCHANGES:
${JSON.stringify(last4Exchanges, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT EXTRACTION TASK (use updateContext tool):

Based on the LAST 4 CONVERSATION EXCHANGES above and the EMPTY CONTEXT FIELDS:
1. Do you see any customer information in those exchanges that can fill empty fields?
2. Look for: name, phone number, email, issue/problem description, service type
3. ONLY extract from CUSTOMER messages (not agent responses)
4. If you find extractable information, call the updateContext tool with {key: value} pairs

Examples:

Customer: "My name is Johnny Jandelkar"
→ Call: updateContext({"customer_name": "Johnny Jandelkar"})

Customer: "I need help with patching a hole in my backyard"
→ Call: updateContext({"customers_main_ask": "Backyard hole repair/patching"})

Customer: "I'm Jane, my number is 555-1234, I need roof repair"
→ Call: updateContext({
  "customer_name": "Jane",
  "customer_phone_number": "555-1234",
  "customers_main_ask": "Roof repair needed"
})

If NO extractable information found in last 4 exchanges, don't call the tool.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE GENERATION RULES:
- Review recent_conversation FIRST to avoid repetition
- NEVER ask questions already answered
- Generate natural 1-2 sentence response ONLY
- NO technical details, JSON, or metadata in customer-facing response

YOUR TASKS:
1. FIRST: Analyze last 4 exchanges → if extractable data found, call updateContext tool
2. THEN: Generate natural customer-facing response

Please reply to customer:`;
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
