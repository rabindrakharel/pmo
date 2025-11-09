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
import { replacePlaceholders } from '../utils/json-path-resolver.js';

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
    const systemPrompt = this.buildReActPrompt(goal, observation, state.context);
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
   * Execute goal and STREAM response (token by token)
   * Same as executeGoal but yields tokens as they arrive
   */
  async *executeGoalStream(
    goalId: string,
    state: AgentContextState,
    userMessage?: string
  ): AsyncGenerator<{ token: string; done: boolean; response?: string }> {
    console.log(`\n🌊 [WorkerReplyAgent] Streaming goal: ${goalId}`);

    // Get goal configuration
    const goal = this.config.goals.find(g => g.goal_id === goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    // OBSERVE: Gather relevant context
    const observation = this.observe(goal, state, userMessage);

    // THINK + ACT: Generate response (streaming)
    const systemPrompt = this.buildReActPrompt(goal, observation, state.context);
    const userPrompt = this.buildUserPrompt(userMessage, goal);

    console.log(`[WorkerReplyAgent] Goal: ${goal.description}`);
    console.log(`[WorkerReplyAgent] Agent Identity: ${this.agentProfile.identity}`);
    console.log(`[WorkerReplyAgent] Streaming: ENABLED`);

    // Call LLM with streaming
    const openaiService = getOpenAIService();
    let fullResponse = '';

    try {
      for await (const chunk of openaiService.callAgentStream({
        agentType: 'worker_reply',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        sessionId: state.sessionId,
      })) {
        if (chunk.done) {
          // Final chunk - yield completion
          console.log(`[WorkerReplyAgent] ✅ Streaming complete (${fullResponse.length} chars)`);
          yield {
            token: '',
            done: true,
            response: fullResponse,
          };
        } else {
          // Token chunk - yield to client
          fullResponse += chunk.token;
          yield {
            token: chunk.token,
            done: false,
          };
        }
      }
    } catch (error: any) {
      console.error(`[WorkerReplyAgent] ❌ Streaming error: ${error.message}`);
      throw error;
    }
  }

  /**
   * OBSERVE: Gather relevant context for decision-making
   */
  private observe(goal: ConversationGoal, state: AgentContextState, userMessage?: string) {
    // Recent conversation (last 3 exchanges for context)
    const recentConversation = (state.context.summary_of_conversation_on_each_step_until_now || []).slice(-3);

    // Success criteria (what we need to accomplish)
    const successCriteria = goal.success_criteria;

    // Current context fields (using nested structure)
    const extractionFields = state.context.data_extraction_fields || {};
    const contextData = {
      customer: {
        name: extractionFields.customer?.name || '(unknown)',
        phone: extractionFields.customer?.phone || '(unknown)',
        id: extractionFields.customer?.id || '(unknown)',
      },
      service: {
        request: extractionFields.service?.primary_request || '(not stated)',
        matching_catalog: extractionFields.service?.catalog_match || '(not matched)',
      },
      operations: {
        solution_plan: extractionFields.operations?.solution_plan || '(no plan)',
        task_id: extractionFields.operations?.task_id || '(not created)',
        appointment: extractionFields.operations?.appointment_details || '(not scheduled)',
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
   * Supports placeholder replacement from session memory (e.g., {{customer.name}})
   */
  private buildReActPrompt(goal: ConversationGoal, observation: any, context: any): string {
    // Get conversation tactics from config
    const tactics = observation.conversationTactics
      .map((tacticId: string) => {
        const tactic = this.config.conversation_tactics[tacticId];
        return tactic ? `- ${tactic.description}` : '';
      })
      .filter(Boolean)
      .join('\n');

    // Replace placeholders in system prompt and goal description with actual session values
    const systemPromptWithValues = replacePlaceholders(this.agentProfile.system_prompt, context);
    const goalDescriptionWithValues = replacePlaceholders(goal.description, context);

    return `# AGENT IDENTITY
${systemPromptWithValues}

# CURRENT GOAL
**Objective:** ${goalDescriptionWithValues}

**Success Criteria (what we need to complete THIS goal):**
${goal.success_criteria.mandatory_fields.map(f => `- ${f}`).join('\n')}

⚠️ **IMPORTANT:** ONLY focus on the fields listed above. Do NOT ask for other information yet (it will be collected in future goals).

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
- What MANDATORY FIELDS (from success criteria) do we still need?
- Which conversation tactic best fits this situation?
- Have we already asked this question? (check recent conversation!)
- ⚠️ CRITICAL: Don't ask for fields NOT in success criteria - other goals will handle them

## 3. ACT (Generate Response)

**Response Guidelines:**
- Be natural, empathetic, and conversational
- Use appropriate tactic from the list above
- Address the CURRENT message first
- NEVER repeat questions from recent conversation
- Keep response to 1-2 sentences
- ONLY ask for fields in success criteria (ignore other empty fields you see in context)
- Focus on progressing toward goal: ${goalDescriptionWithValues}

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
