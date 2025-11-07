/**
 * Agent Profiles Service
 * Three specialized LLM agents that drive the conversation system
 * - Navigator Agent: Decides which node to execute next
 * - Worker Agent: Handles prompts and generates responses
 * - Guider Agent: Validates conversation direction
 * @module orchestrator/langgraph/agent-profiles
 */

import { getOpenAIService } from '../services/openai.service.js';

/**
 * Navigation Decision from Navigator Agent
 */
export interface NavigationDecision {
  next_node: string;
  reasoning: string;
  flags_to_update: Record<string, number>;
  skip_current_node: boolean;
}

/**
 * Worker Response from Worker Agent
 */
export interface WorkerResponse {
  response: string;
  context_updates: Record<string, any>;
  flag_updates: Record<string, number>;
}

/**
 * Guidance Check from Guider Agent
 */
export interface GuidanceCheck {
  is_on_track: boolean;
  reasoning: string;
  suggested_correction?: string;
}

/**
 * Agent Profiles
 * Implements the three agent types defined in dag.json AGENT_PROFILE
 */
export class AgentProfiles {
  /**
   * NAVIGATOR AGENT
   * Role: Decides which node to go next based on context analysis
   */
  async navigateNextNode(
    currentContext: Record<string, any>,
    lastUserMessage?: string,
    availableNodes?: string[]
  ): Promise<NavigationDecision> {
    console.log(`\n[Navigator Agent] 🧭 Analyzing context to determine next node...`);

    const openaiService = getOpenAIService();

    const systemPrompt = `You are the Navigator Agent - an intelligent routing controller.

Your Role: Analyze the conversation context and decide which node should execute next.

Core Responsibilities:
1. Check flags (0 = not done, 1 = done) to skip completed steps
2. Detect if customer changed their issue → reset issue-related flags, route to Identify_Issue
3. Detect if customer updating data → reset data flag, route to Try_To_Gather_Customers_Data
4. Ensure mandatory fields (customers_main_ask, customer_phone_number) are collected
5. Follow logical conversation flow

Available Nodes: ${availableNodes?.join(', ') || 'GREET_CUSTOMER, ASK_CUSTOMER_ABOUT_THEIR_NEED, Identify_Issue, use_mcp_to_get_info, Empathize, Console_Build_Rapport, Try_To_Gather_Customers_Data, Check_IF_existing_customer, Plan, Communicate_To_Customer_Before_Action, Execute_Plan_Using_MCP, Tell_Customers_Execution, Goodbye_And_Hangup'}

Return JSON:
{
  "next_node": "node_name",
  "reasoning": "why this node?",
  "flags_to_update": {"flag_name": 0 or 1},
  "skip_current_node": false
}`;

    const userPrompt = `Current Context:
${JSON.stringify(currentContext, null, 2)}

${lastUserMessage ? `Last User Message: "${lastUserMessage}"\n` : ''}
Analyze and decide: Which node should execute next?`;

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

      const decision = JSON.parse(result.content);

      console.log(`[Navigator Agent] ✅ Decision: ${decision.next_node}`);
      console.log(`[Navigator Agent] 📝 Reasoning: ${decision.reasoning}`);

      return {
        next_node: decision.next_node,
        reasoning: decision.reasoning,
        flags_to_update: decision.flags_to_update || {},
        skip_current_node: decision.skip_current_node || false,
      };
    } catch (error: any) {
      console.error(`[Navigator Agent] ❌ Error:`, error.message);

      // Fallback: continue to next logical node
      return {
        next_node: 'ASK_CUSTOMER_ABOUT_THEIR_NEED',
        reasoning: 'Fallback due to error',
        flags_to_update: {},
        skip_current_node: false,
      };
    }
  }

  /**
   * WORKER AGENT
   * Role: Handles prompts, generates responses, basic inference
   */
  async processWork(
    nodePrompt: string,
    nodeGoal: string,
    currentContext: Record<string, any>,
    userMessage?: string
  ): Promise<WorkerResponse> {
    console.log(`\n[Worker Agent] 💼 Processing work...`);

    const openaiService = getOpenAIService();

    const systemPrompt = `You are the Worker Agent - a responsive and intelligent assistant.

Your Role: Generate appropriate responses and update context based on conversation analysis.

Core Responsibilities:
1. Generate natural, helpful responses to customers
2. Extract information from customer messages
3. Update context fields with new information
4. Set flags to 1 when completing a step
5. Preserve existing context values (non-destructive updates)

Node Goal: ${nodeGoal}

Return JSON:
{
  "response": "message to customer",
  "context_updates": {"field": "value"},
  "flag_updates": {"flag_name": 1}
}`;

    const userPrompt = `${nodePrompt}

Current Context:
${JSON.stringify(currentContext, null, 2)}

${userMessage ? `User Message: "${userMessage}"\n` : ''}
Generate response and context updates:`;

    try {
      const result = await openaiService.callAgent({
        agentType: 'worker',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        jsonMode: true,
      });

      const work = JSON.parse(result.content);

      console.log(`[Worker Agent] ✅ Response generated`);
      console.log(`[Worker Agent] 📝 Context updates:`, Object.keys(work.context_updates || {}));

      return {
        response: work.response || '',
        context_updates: work.context_updates || {},
        flag_updates: work.flag_updates || {},
      };
    } catch (error: any) {
      console.error(`[Worker Agent] ❌ Error:`, error.message);

      return {
        response: 'I apologize, but I encountered an issue. How can I assist you?',
        context_updates: {},
        flag_updates: {},
      };
    }
  }

  /**
   * GUIDER AGENT
   * Role: Checks if conversation is going in a good direction
   */
  async checkGuidance(
    currentContext: Record<string, any>,
    conversationHistory: Array<{ customer: string; agent: string }>,
    currentNode: string
  ): Promise<GuidanceCheck> {
    console.log(`\n[Guider Agent] 🎯 Checking conversation direction...`);

    const openaiService = getOpenAIService();

    const systemPrompt = `You are the Guider Agent - a quality control supervisor.

Your Role: Evaluate if the conversation is progressing well towards resolution.

Core Responsibilities:
1. Check if mandatory fields are being collected (customers_main_ask, customer_phone_number)
2. Verify conversation is logical and helpful
3. Detect if agent is stuck in loops
4. Identify if customer is frustrated or confused
5. Suggest corrections if needed

Return JSON:
{
  "is_on_track": true/false,
  "reasoning": "explanation",
  "suggested_correction": "what to do if off track"
}`;

    const recentHistory = conversationHistory.slice(-5);
    const userPrompt = `Current Node: ${currentNode}

Context:
${JSON.stringify(currentContext, null, 2)}

Recent Conversation:
${recentHistory.map((h, i) => `${i + 1}. Customer: ${h.customer}\n   Agent: ${h.agent}`).join('\n')}

Is the conversation going in a good direction? Evaluate:`;

    try {
      const result = await openaiService.callAgent({
        agentType: 'planner',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        jsonMode: true,
      });

      const guidance = JSON.parse(result.content);

      console.log(`[Guider Agent] ${guidance.is_on_track ? '✅' : '⚠️'} On Track: ${guidance.is_on_track}`);
      console.log(`[Guider Agent] 📝 Reasoning: ${guidance.reasoning}`);

      return {
        is_on_track: guidance.is_on_track !== false,
        reasoning: guidance.reasoning,
        suggested_correction: guidance.suggested_correction,
      };
    } catch (error: any) {
      console.error(`[Guider Agent] ❌ Error:`, error.message);

      return {
        is_on_track: true,
        reasoning: 'Unable to evaluate, assuming on track',
      };
    }
  }
}

/**
 * Singleton instance
 */
let instance: AgentProfiles | null = null;

export function getAgentProfiles(): AgentProfiles {
  if (!instance) {
    instance = new AgentProfiles();
  }
  return instance;
}
