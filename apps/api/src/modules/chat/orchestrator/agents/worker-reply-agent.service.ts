/**
 * Worker Reply Agent - Goal-Oriented with ReAct Pattern
 *
 * Responsibilities:
 * - Observe: Current goal, context, conversation history
 * - Think: Determine what to say to progress toward goal
 * - Act: Generate natural customer-facing response
 * - Uses agent profile for consistent identity/behavior
 *
 * @module orchestrator/agents/worker-reply-agent
 * @version 3.0.0
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { AgentConfigV3, ConversationGoal, AgentProfile } from '../config/agent-config.schema.js';

/**
 * Worker Reply Agent Result
 */
export interface WorkerReplyResult {
  response: string;
  thought?: string; // ReAct pattern: agent's reasoning
}

/**
 * Worker Reply Agent Service
 * Uses ReAct pattern with persistent agent identity
 */
export class WorkerReplyAgent {
  private config: AgentConfigV3;
  private agentProfile: AgentProfile;

  constructor(config: AgentConfigV3, agentProfileId: string = 'conversational_agent') {
    this.config = config;

    // Get agent profile from config
    const profile = config.agent_profiles[agentProfileId];
    if (!profile) {
      throw new Error(`Agent profile not found: ${agentProfileId}`);
    }
    this.agentProfile = profile;

    console.log(`[WorkerReplyAgent] 🎭 Initialized with profile: ${this.agentProfile.identity}`);
  }

  /**
   * Execute goal: Generate customer response using ReAct pattern
   *
   * ReAct Steps:
   * 1. OBSERVE: Current goal, context, conversation
   * 2. THINK: What needs to be done to progress toward goal
   * 3. ACT: Generate response to customer
   */
  async executeGoal(
    goalId: string,
    state: AgentContextState,
    userMessage?: string
  ): Promise<WorkerReplyResult> {
    console.log(`\n🗣️  [WorkerReplyAgent] Executing goal: ${goalId}`);

    // Get goal configuration
    const goal = this.config.goals.find(g => g.goal_id === goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    // OBSERVE: Gather relevant context
    const observation = this.observe(goal, state, userMessage);

    // THINK + ACT: Generate response (combined for efficiency)
    const systemPrompt = this.buildReActPrompt(goal, observation);
    const userPrompt = this.buildUserPrompt(userMessage, goal);

    console.log(`[WorkerReplyAgent] Goal: ${goal.description}`);
    console.log(`[WorkerReplyAgent] Agent Identity: ${this.agentProfile.identity}`);

    // Call LLM to generate response
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker_reply',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      sessionId: state.sessionId,
    });

    const response = result.content || '';

    console.log(`[WorkerReplyAgent] ✅ Generated response (${response.length} chars)`);

    return {
      response,
    };
  }

  /**
   * OBSERVE: Gather relevant context for decision-making
   */
  private observe(goal: ConversationGoal, state: AgentContextState, userMessage?: string) {
    // Recent conversation (last 3 exchanges for context)
    const recentConversation = (state.context.summary_of_conversation_on_each_step_until_now || []).slice(-3);

    // Success criteria (what we need to accomplish)
    const successCriteria = goal.success_criteria;

    // Current context fields
    const contextData = {
      customer: {
        name: state.context.data_extraction_fields?.customer_name || '(unknown)',
        phone: state.context.data_extraction_fields?.customer_phone_number || '(unknown)',
        id: state.context.data_extraction_fields?.customer_id || '(unknown)',
      },
      service: {
        request: state.context.data_extraction_fields?.customers_main_ask || '(not stated)',
        matching_catalog: state.context.data_extraction_fields?.matching_service_catalog_to_solve_customers_issue || '(not matched)',
      },
      operations: {
        task_id: state.context.data_extraction_fields?.task_id || '(not created)',
        appointment: state.context.data_extraction_fields?.appointment_details || '(not scheduled)',
      },
      next_action: state.context.next_course_of_action || '(no guidance)',
    };

    return {
      currentMessage: userMessage,
      recentConversation,
      successCriteria,
      contextData,
      conversationTactics: goal.conversation_tactics || [],
    };
  }

  /**
   * BUILD REACT PROMPT: Combines THINK and ACT stages
   * Uses declarative agent profile and goal configuration
   */
  private buildReActPrompt(goal: ConversationGoal, observation: any): string {
    // Get conversation tactics from config
    const tactics = observation.conversationTactics
      .map((tacticId: string) => {
        const tactic = this.config.conversation_tactics[tacticId];
        return tactic ? `- ${tactic.description}` : '';
      })
      .filter(Boolean)
      .join('\n');

    return `# AGENT IDENTITY
${this.agentProfile.system_prompt}

# CURRENT GOAL
**Objective:** ${goal.description}

**Success Criteria (what we need):**
${goal.success_criteria.mandatory_fields.map(f => `- ${f}`).join('\n')}

**Conversation Tactics to Use:**
${tactics}

# REACT: OBSERVE → THINK → ACT

## 1. OBSERVE (Current Situation)

**Recent Conversation (last 3 exchanges):**
${observation.recentConversation.map((ex: any, i: number) =>
  `[${i + 1}] Customer: "${ex.customer}"\n    Agent: "${ex.agent}"`
).join('\n\n')}

**Current Context:**
\`\`\`json
${JSON.stringify(observation.contextData, null, 2)}
\`\`\`

**Guidance from System:** ${observation.contextData.next_action}

${observation.currentMessage ? `
**🔴 CURRENT CUSTOMER MESSAGE (MOST IMPORTANT):**
"${observation.currentMessage}"
` : ''}

## 2. THINK (Reasoning)

Based on observations:
- What is the customer trying to accomplish?
- What information do we have vs. what do we need (success criteria)?
- Which conversation tactic best fits this situation?
- Have we already asked this question? (check recent conversation!)

## 3. ACT (Generate Response)

**Response Guidelines:**
- Be natural, empathetic, and conversational
- Use appropriate tactic from the list above
- Address the CURRENT message first
- NEVER repeat questions from recent conversation
- Keep response to 1-2 sentences
- Focus on progressing toward goal: ${goal.description}

Generate your response now:`;
  }

  /**
   * Build user prompt (simple task instruction)
   */
  private buildUserPrompt(userMessage?: string, goal?: ConversationGoal): string {
    if (userMessage) {
      return `Customer just said: "${userMessage}"\n\nRespond appropriately to help achieve goal: ${goal?.description}`;
    }
    return `Generate appropriate response to progress toward goal: ${goal?.description}`;
  }

  /**
   * LEGACY METHOD: Maintain backward compatibility during transition
   * Maps old executeNode to new executeGoal
   * TODO: Remove after full migration
   */
  async executeNode(
    nodeName: string,
    state: AgentContextState,
    userMessage?: string
  ): Promise<WorkerReplyResult> {
    console.log(`[WorkerReplyAgent] ⚠️  Legacy executeNode called, mapping to executeGoal`);
    // Map node name to goal ID (temporary)
    return this.executeGoal(nodeName, state, userMessage);
  }
}

/**
 * Create worker reply agent instance
 */
export function createWorkerReplyAgent(
  config: AgentConfigV3,
  agentProfileId: string = 'conversational_agent'
): WorkerReplyAgent {
  return new WorkerReplyAgent(config, agentProfileId);
}
