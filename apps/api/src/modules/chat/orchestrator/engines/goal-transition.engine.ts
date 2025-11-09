/**
 * Goal Transition Engine
 * Evaluates goal completion and determines next goal using LLM-based semantic routing
 * Replaces rigid node-based navigation with flexible goal-oriented transitions
 *
 * @module orchestrator/engines/goal-transition
 * @version 3.0.0
 */

import { getOpenAIService } from '../services/openai.service.js';
import type {
  AgentConfigV3,
  ConversationGoal,
  AdvanceCondition,
  GoalTransitionResult,
  CriteriaCheckResult,
  ConversationContextV3
} from '../config/agent-config.schema.js';

interface AdvanceEvaluationResult {
  matched: boolean;
  nextGoal: string | null;
  reason: string;
  condition?: string;
  conditionIndex?: number;
  confidence?: number;
}

export class GoalTransitionEngine {
  private config: AgentConfigV3;

  constructor(config: AgentConfigV3) {
    this.config = config;
  }

  /**
   * Evaluate if current goal is complete and determine next goal
   * Uses LLM to evaluate semantic conditions for flexible routing
   */
  async evaluateTransition(
    currentGoalId: string,
    context: ConversationContextV3,
    conversationHistory: Array<{ customer: string; agent: string }>
  ): Promise<GoalTransitionResult> {
    console.log(`\n🎯 [GoalTransitionEngine] Evaluating goal: ${currentGoalId}`);

    const currentGoal = this.config.goals.find(g => g.goal_id === currentGoalId);
    if (!currentGoal) {
      throw new Error(`Goal not found: ${currentGoalId}`);
    }

    // 1. Check success criteria (mandatory fields) - Deterministic
    const criteriaResult = this.checkSuccessCriteria(currentGoal, context);

    if (!criteriaResult.met) {
      console.log(`[GoalTransitionEngine] ❌ Success criteria not met: ${criteriaResult.missing.join(', ')}`);
      return {
        shouldTransition: false,
        currentGoal: currentGoalId,
        nextGoal: null,
        reason: `Missing required fields: ${criteriaResult.missing.join(', ')}`,
        criteriaStatus: criteriaResult
      };
    }

    console.log(`[GoalTransitionEngine] ✅ Success criteria met: ${criteriaResult.satisfied.join(', ')}`);

    // 2. Evaluate advance conditions using LLM (semantic)
    const advanceResult = await this.evaluateAdvanceConditions(
      currentGoal,
      context,
      conversationHistory
    );

    if (advanceResult.matched) {
      console.log(`[GoalTransitionEngine] ✅ Transition to: ${advanceResult.nextGoal}`);
      console.log(`[GoalTransitionEngine] 💭 Reason: ${advanceResult.reason}`);

      return {
        shouldTransition: true,
        currentGoal: currentGoalId,
        nextGoal: advanceResult.nextGoal,
        reason: advanceResult.reason,
        matchedCondition: advanceResult.condition,
        criteriaStatus: criteriaResult
      };
    }

    // 3. No transition conditions met - stay in current goal
    console.log(`[GoalTransitionEngine] ⏸️  Staying in goal: ${currentGoalId}`);
    return {
      shouldTransition: false,
      currentGoal: currentGoalId,
      nextGoal: null,
      reason: advanceResult.reason || 'Goal in progress',
      criteriaStatus: criteriaResult
    };
  }

  /**
   * Check mandatory fields and conditional fields
   * This is deterministic (no LLM needed)
   */
  private checkSuccessCriteria(
    goal: ConversationGoal,
    context: ConversationContextV3
  ): CriteriaCheckResult {
    const missing: string[] = [];
    const satisfied: string[] = [];

    // Check mandatory fields
    for (const field of goal.success_criteria.mandatory_fields) {
      const value = this.getNestedField(context, field);
      if (!value || value === '' || value === '(not set)') {
        missing.push(field);
      } else {
        satisfied.push(field);
      }
    }

    // Check conditional fields (if applicable)
    if (goal.success_criteria.conditional_fields) {
      for (const [condition, fields] of Object.entries(goal.success_criteria.conditional_fields)) {
        if (this.evaluateSimpleCondition(condition, context)) {
          for (const field of fields) {
            const value = this.getNestedField(context, field);
            if (!value || value === '' || value === '(not set)') {
              missing.push(`${field} (conditional: ${condition})`);
            } else {
              satisfied.push(field);
            }
          }
        }
      }
    }

    return {
      met: missing.length === 0,
      missing,
      satisfied
    };
  }

  /**
   * Evaluate advance conditions using LLM for semantic understanding
   * This is where "soft semantic routing" happens
   */
  private async evaluateAdvanceConditions(
    goal: ConversationGoal,
    context: ConversationContextV3,
    conversationHistory: Array<{ customer: string; agent: string }>
  ): Promise<AdvanceEvaluationResult> {
    const conditions = goal.auto_advance_conditions;

    if (!conditions || conditions.length === 0) {
      return { matched: false, nextGoal: null, reason: 'No advance conditions defined' };
    }

    // Build prompt for LLM to evaluate conditions
    const systemPrompt = this.buildConditionEvaluationPrompt(goal, conditions);
    const userPrompt = this.buildConditionEvaluationUserPrompt(context, conversationHistory);

    try {
      const openaiService = getOpenAIService();
      const result = await openaiService.callAgent({
        agentType: 'planner',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        jsonMode: true,
        sessionId: context.session.id
      });

      const decision = JSON.parse(result.content || '{"matched": false, "reason": "Unable to parse response"}');

      if (decision.matched && decision.condition_index !== undefined) {
        const condition = conditions[decision.condition_index];
        return {
          matched: true,
          nextGoal: condition.next_goal,
          reason: decision.reason,
          condition: condition.condition,
          conditionIndex: decision.condition_index,
          confidence: decision.confidence || 0.8
        };
      }

      return {
        matched: false,
        nextGoal: null,
        reason: decision.reason || 'No conditions matched'
      };
    } catch (error: any) {
      console.error(`[GoalTransitionEngine] ❌ Error evaluating conditions: ${error.message}`);
      return {
        matched: false,
        nextGoal: null,
        reason: `Error: ${error.message}`
      };
    }
  }

  /**
   * Build system prompt for condition evaluation
   */
  private buildConditionEvaluationPrompt(
    goal: ConversationGoal,
    conditions: AdvanceCondition[]
  ): string {
    return `You are a goal transition evaluator for a customer service AI system.

Current Goal: ${goal.goal_id}
Description: ${goal.description}

Available Transition Conditions:
${conditions.map((c, i) => `${i}. "${c.condition}" → Next Goal: ${c.next_goal}`).join('\n')}

Your Task:
1. Analyze the conversation context and history
2. Determine if ANY of the conditions above are satisfied
3. Return JSON with your evaluation

Output JSON Schema:
{
  "matched": boolean,              // True if a condition is matched
  "condition_index": number,       // Index of matched condition (0-based)
  "reason": string,                // Brief explanation of your decision
  "confidence": number             // 0.0 to 1.0 confidence score
}

Evaluation Guidelines:
- Conditions are semantic descriptions, not rigid patterns
- Use natural language understanding to interpret conditions
- Consider customer's latest message and overall conversation flow
- Prefer advancing when success criteria are clearly met
- Stay in current goal if conditions are ambiguous (confidence < 0.6)
- Return the FIRST matching condition if multiple match

Example Condition Interpretations:
- "customer consents" → Look for affirmative responses: "yes", "okay", "sounds good", "let's do it"
- "customer rejects plan" → Look for negative responses: "no", "I don't want", "that won't work"
- "issue is clear" → Customer's problem description is specific and actionable
- "all mandatory fields collected" → Check if required data is present in context

Critical Rules:
1. ONLY match a condition if you're confident (>0.6) it's satisfied
2. If uncertain, return matched: false
3. Provide clear reasoning for your decision
4. Consider conversation flow and customer intent`;
  }

  /**
   * Build user prompt with context and conversation
   */
  private buildConditionEvaluationUserPrompt(
    context: ConversationContextV3,
    conversationHistory: Array<{ customer: string; agent: string }>
  ): string {
    const recentHistory = conversationHistory.slice(-5); // Last 5 exchanges

    return `Context Data:
${JSON.stringify(this.getRelevantContext(context), null, 2)}

Recent Conversation (last 5 exchanges):
${recentHistory.map((ex, i) => `
Exchange ${i + 1}:
  Customer: ${ex.customer}
  Agent: ${ex.agent}
`).join('\n')}

Current Goal Status:
- Total Turns in Conversation: ${context.metadata.total_turns}
- Current Goal: ${context.conversation.current_goal}
- Completed Goals: ${context.conversation.completed_goals.join(', ') || 'None'}

Evaluate which transition condition (if any) is satisfied.`;
  }

  /**
   * Get nested field from context (supports dot notation)
   */
  private getNestedField(context: any, field: string): any {
    const parts = field.split('.');
    let value = context;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * Simple condition evaluation (for conditional fields)
   * This is for simple boolean checks, not semantic conditions
   */
  private evaluateSimpleCondition(condition: string, context: ConversationContextV3): boolean {
    // Example: "if_new_customer" → check if customer_id is empty
    if (condition === 'if_new_customer') {
      return !context.customer?.id;
    }
    if (condition === 'if_service_request') {
      return !!context.service?.primary_request;
    }
    if (condition === 'if_existing_customer') {
      return !!context.customer?.id;
    }
    return false;
  }

  /**
   * Extract relevant context fields for condition evaluation
   */
  private getRelevantContext(context: ConversationContextV3): any {
    return {
      customer: {
        id: context.customer?.id,
        name: context.customer?.name,
        phone: context.customer?.phone
      },
      service: {
        primary_request: context.service?.primary_request,
        service_category: context.service?.service_category,
        urgency: context.service?.urgency
      },
      operations: {
        task_id: context.operations?.task_id,
        appointment: context.operations?.appointment,
        solution_plan: context.operations?.solution_plan
      },
      state: context.state,
      metadata: {
        total_turns: context.metadata.total_turns,
        total_goals_completed: context.metadata.total_goals_completed
      }
    };
  }

  /**
   * Get goal by ID
   */
  getGoal(goalId: string): ConversationGoal | undefined {
    return this.config.goals.find(g => g.goal_id === goalId);
  }

  /**
   * Get all goals
   */
  getAllGoals(): ConversationGoal[] {
    return this.config.goals;
  }
}

/**
 * Factory function to create GoalTransitionEngine
 */
export function createGoalTransitionEngine(config: AgentConfigV3): GoalTransitionEngine {
  return new GoalTransitionEngine(config);
}
