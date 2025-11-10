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
  GoalTransitionResult,
  CriteriaCheckResult
} from '../config/agent-config.schema.js';
import type { DAGContext } from '../agents/dag-types.js';
import { evaluateDeterministicCondition } from '../utils/json-path-resolver.js';

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
    context: DAGContext,
    conversationHistory: Array<{ customer: string; agent: string }>,
    sessionId?: string
  ): Promise<GoalTransitionResult> {
    console.log(`\n🎯 [GoalTransitionEngine] Evaluating goal: ${currentGoalId}`);

    const currentGoal = this.config.goals.find(g => g.goal_id === currentGoalId);
    if (!currentGoal) {
      throw new Error(`Goal not found: ${currentGoalId}`);
    }

    // 1. Check success criteria (mandatory fields + quality checks)
    const criteriaResult = await this.checkSuccessCriteria(currentGoal, context, conversationHistory);

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
   * Check mandatory fields, conditional fields, and quality checks
   * Mandatory/conditional fields are deterministic (instant)
   * Quality checks are semantic (LLM-based)
   */
  private async checkSuccessCriteria(
    goal: ConversationGoal,
    context: DAGContext,
    conversationHistory: Array<{ customer: string; agent: string }>,
    sessionId?: string
  ): Promise<CriteriaCheckResult> {
    const missing: string[] = [];
    const satisfied: string[] = [];

    // If no criteria defined, consider it met
    if (!goal.goal_success_criteria) {
      return { met: true, missing: [], satisfied: [] };
    }

    const goalCriteria = goal.goal_success_criteria;

    // Check all_of conditions
    if (goalCriteria.all_of && Array.isArray(goalCriteria.all_of)) {
      for (const condition of goalCriteria.all_of) {
        const result = evaluateDeterministicCondition(
          context,
          condition.json_path,
          condition.operator,
          condition.value
        );
        if (!result) {
          missing.push(condition.json_path);
        } else {
          satisfied.push(condition.json_path);
        }
      }
    }

    // Check any_of conditions (at least one must be true)
    if (goalCriteria.any_of && Array.isArray(goalCriteria.any_of)) {
      let anyMatched = false;
      for (const condition of goalCriteria.any_of) {
        const result = evaluateDeterministicCondition(
          context,
          condition.json_path,
          condition.operator,
          condition.value
        );
        if (result) {
          anyMatched = true;
          satisfied.push(condition.json_path);
        }
      }
      if (!anyMatched) {
        missing.push('any_of conditions');
      }
    }

    return {
      met: missing.length === 0,
      missing,
      satisfied
    };
  }


  /**
   * Evaluate advance conditions with hybrid branching:
   * 1. DETERMINISTIC: Fast JSON path checks (instant, no LLM)
   * 2. COMPOUND: all_of/any_of nested conditions (instant, no LLM)
   * 3. SEMANTIC: LLM-evaluated natural language conditions (flexible but slower)
   *
   * Deterministic conditions are checked first for performance
   */
  private async evaluateAdvanceConditions(
    goal: ConversationGoal,
    context: DAGContext,
    conversationHistory: Array<{ customer: string; agent: string }>,
    sessionId?: string
  ): Promise<AdvanceEvaluationResult> {
    const branchingCondition = goal.goal_branching_condition;

    if (!branchingCondition || !branchingCondition.rules) {
      return { matched: false, nextGoal: null, reason: 'No branching conditions defined' };
    }

    console.log(`[GoalTransitionEngine] 🔍 Evaluating goal_branching_condition (${branchingCondition.rules.length} rules)`);

    // Sort rules by priority (higher priority first)
    const sortedRules = [...branchingCondition.rules].sort((a: any, b: any) =>
      (b.priority || 0) - (a.priority || 0)
    );

    // Evaluate each rule in priority order
    for (let i = 0; i < sortedRules.length; i++) {
      const rule = sortedRules[i];

      // Evaluate compound condition (supports all_of, any_of, single json_path, or string)
      const result = await this.evaluateCompoundCondition(
        rule.condition,
        context,
        conversationHistory,
        i,
        rule.priority || 0,
        sessionId
      );

      if (result.matched) {
        console.log(`[GoalTransitionEngine] ✅ MATCHED: Transition to ${rule.next_goal}`);
        return {
          matched: true,
          nextGoal: rule.next_goal,
          reason: result.reason,
          condition: result.conditionSummary,
          conditionIndex: i,
          confidence: result.confidence
        };
      }
    }

    return {
      matched: false,
      nextGoal: null,
      reason: 'No branching conditions matched'
    };
  }

  /**
   * Evaluate compound conditions recursively
   * Supports: all_of, any_of, single json_path conditions, and semantic strings
   */
  private async evaluateCompoundCondition(
    condition: any,
    context: DAGContext,
    conversationHistory: Array<{ customer: string; agent: string }>,
    ruleIndex: number,
    priority: number,
    sessionId?: string
  ): Promise<{ matched: boolean; reason: string; conditionSummary: string; confidence: number }> {
    // Case 1: Semantic condition (string)
    if (typeof condition === 'string') {
      const semanticResult = await this.evaluateSemanticCondition(
        condition,
        context,
        conversationHistory,
        sessionId
      );

      console.log(`[GoalTransitionEngine]    [${ruleIndex}] SEMANTIC (priority: ${priority}): "${condition}" → ${semanticResult.result ? '✅ YES' : '❌ NO'} (confidence: ${semanticResult.confidence})`);

      return {
        matched: semanticResult.result,
        reason: `Semantic condition: ${condition}. ${semanticResult.reasoning}`,
        conditionSummary: condition,
        confidence: semanticResult.confidence
      };
    }

    // Case 2: Single deterministic condition (json_path)
    if (typeof condition === 'object' && condition.json_path) {
      const result = evaluateDeterministicCondition(
        context,
        condition.json_path,
        condition.operator,
        condition.value
      );

      console.log(`[GoalTransitionEngine]    [${ruleIndex}] DETERMINISTIC (priority: ${priority}): ${condition.json_path} ${condition.operator} → ${result ? '✅ TRUE' : '❌ FALSE'}`);

      return {
        matched: result,
        reason: `Deterministic condition: ${condition.json_path} ${condition.operator}`,
        conditionSummary: `${condition.json_path} ${condition.operator}`,
        confidence: 1.0
      };
    }

    // Case 3: all_of compound condition (ALL must be true)
    if (typeof condition === 'object' && condition.all_of && Array.isArray(condition.all_of)) {
      const results: boolean[] = [];
      const summaries: string[] = [];

      console.log(`[GoalTransitionEngine]    [${ruleIndex}] COMPOUND all_of (priority: ${priority}): ${condition.all_of.length} sub-conditions`);

      for (const subCondition of condition.all_of) {
        const subResult = await this.evaluateCompoundCondition(
          subCondition,
          context,
          conversationHistory,
          ruleIndex,
          priority,
          sessionId
        );
        results.push(subResult.matched);
        summaries.push(subResult.conditionSummary);
      }

      const allTrue = results.every(r => r === true);
      console.log(`[GoalTransitionEngine]       → all_of result: ${allTrue ? '✅ ALL TRUE' : '❌ SOME FALSE'} (${results.filter(r => r).length}/${results.length})`);

      return {
        matched: allTrue,
        reason: allTrue
          ? `All conditions met: ${summaries.join(', ')}`
          : `Not all conditions met (${results.filter(r => r).length}/${results.length})`,
        conditionSummary: `all_of[${summaries.join(', ')}]`,
        confidence: 1.0
      };
    }

    // Case 4: any_of compound condition (ANY must be true)
    if (typeof condition === 'object' && condition.any_of && Array.isArray(condition.any_of)) {
      const results: boolean[] = [];
      const summaries: string[] = [];

      console.log(`[GoalTransitionEngine]    [${ruleIndex}] COMPOUND any_of (priority: ${priority}): ${condition.any_of.length} sub-conditions`);

      for (const subCondition of condition.any_of) {
        const subResult = await this.evaluateCompoundCondition(
          subCondition,
          context,
          conversationHistory,
          ruleIndex,
          priority,
          sessionId
        );
        results.push(subResult.matched);
        summaries.push(subResult.conditionSummary);
      }

      const anyTrue = results.some(r => r === true);
      console.log(`[GoalTransitionEngine]       → any_of result: ${anyTrue ? '✅ ANY TRUE' : '❌ ALL FALSE'} (${results.filter(r => r).length}/${results.length})`);

      return {
        matched: anyTrue,
        reason: anyTrue
          ? `At least one condition met: ${summaries.filter((_, idx) => results[idx]).join(', ')}`
          : 'No conditions met',
        conditionSummary: `any_of[${summaries.join(', ')}]`,
        confidence: 1.0
      };
    }

    // Unknown condition type
    console.log(`[GoalTransitionEngine]    [${ruleIndex}] UNKNOWN CONDITION TYPE - Skipping`);
    return {
      matched: false,
      reason: 'Unknown condition type',
      conditionSummary: 'unknown',
      confidence: 0.0
    };
  }

  /**
   * Evaluate semantic condition using fast yes/no LLM question
   * Uses a lightweight prompt to minimize latency and cost
   */
  private async evaluateSemanticCondition(
    condition: string,
    context: DAGContext,
    conversationHistory: Array<{ customer: string; agent: string }>,
    sessionId?: string
  ): Promise<{ result: boolean; confidence: number; reasoning: string }> {
    const openai = getOpenAIService();
    const relevantContext = this.getRelevantContext(context);

    // Format conversation history
    const recentHistory = conversationHistory.slice(-3); // Last 3 turns for context
    const historyText = recentHistory
      .map(turn => `Customer: ${turn.customer}\nAgent: ${turn.agent}`)
      .join('\n\n');

    // Fast yes/no evaluation prompt
    const systemPrompt = `You are a decision engine for a conversation routing system.
Your task is to evaluate whether a specific condition is TRUE or FALSE based on the conversation context.

Answer in JSON format:
{
  "result": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Be decisive and fast. If unsure, prefer false with lower confidence.`;

    const userPrompt = `CONDITION TO EVALUATE:
"${condition}"

CONVERSATION CONTEXT:
${JSON.stringify(relevantContext, null, 2)}

RECENT CONVERSATION:
${historyText || 'No conversation history yet'}

Is the condition TRUE or FALSE?`;

    try {
      const response = await openai.callAgent({
        agentType: 'decision_engine',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1, // Low temperature for consistent yes/no decisions
        maxTokens: 150,   // Short response for speed
        jsonMode: true,
        sessionId
      });

      const parsed = JSON.parse(response.content);

      return {
        result: parsed.result === true,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
    } catch (error: any) {
      console.error(`[GoalTransitionEngine] ❌ Semantic condition evaluation failed:`, error.message);
      // On error, default to false with low confidence
      return {
        result: false,
        confidence: 0.0,
        reasoning: `Evaluation error: ${error.message}`
      };
    }
  }

  /**
   * Extract relevant context fields for condition evaluation
   */
  private getRelevantContext(context: DAGContext): any {
    const fields = context.data_extraction_fields || {};

    return {
      customer: {
        id: fields.customer?.id,
        name: fields.customer?.name,
        phone: fields.customer?.phone,
        email: fields.customer?.email,
        address_street: fields.customer?.address_street,
        address_city: fields.customer?.address_city,
        address_state: fields.customer?.address_state,
        address_zipcode: fields.customer?.address_zipcode,
        address_country: fields.customer?.address_country
      },
      service: {
        primary_request: fields.service?.primary_request,
        catalog_match: fields.service?.catalog_match,
        related_entities: fields.service?.related_entities
      },
      operations: {
        task_id: fields.operations?.task_id,
        task_name: fields.operations?.task_name,
        solution_plan: fields.operations?.solution_plan,
        appointment_details: fields.operations?.appointment_details
      },
      project: {
        id: fields.project?.id
      },
      assignment: {
        employee_id: fields.assignment?.employee_id,
        employee_name: fields.assignment?.employee_name
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
