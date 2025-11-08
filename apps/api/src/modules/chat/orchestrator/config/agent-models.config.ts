/**
 * Agent Model Configuration
 * Configure different LLM models for each agent type
 * @module orchestrator/config/agent-models
 */

export interface AgentModelConfig {
  /** Model name/ID (e.g., 'gpt-3.5-turbo', 'gpt-4', 'claude-haiku') */
  model: string;

  /** Temperature for this agent */
  temperature: number;

  /** Max tokens for this agent */
  maxTokens: number;

  /** Cost per 1K tokens (USD) */
  costPer1KTokens: number;

  /** Description of why this model is used */
  rationale?: string;
}

/**
 * Model configurations for each agent type
 */
export const AGENT_MODEL_CONFIG: Record<string, AgentModelConfig> = {
  /**
   * Orchestrator - Needs good reasoning and planning
   * Uses GPT-4o mini for cost-effective intent detection and coordination
   */
  orchestrator: {
    model: process.env.ORCHESTRATOR_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 1000,
    costPer1KTokens: 0.0004, // GPT-4o mini: $0.150/1M input + $0.600/1M output ≈ $0.4/1K avg
    rationale: 'Needs good reasoning for intent detection and workflow coordination'
  },

  /**
   * Planner/Navigator - Decides next node in conversation flow
   * Uses GPT-4o mini for fast, cost-effective routing decisions
   */
  planner: {
    model: process.env.PLANNER_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 800,
    costPer1KTokens: 0.0004,
    rationale: 'Fast semantic routing and conversation navigation'
  },

  /**
   * Worker - Does most of the heavy lifting
   * Uses GPT-4o mini for natural language and tool use
   */
  worker: {
    model: process.env.WORKER_MODEL || 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1500,
    costPer1KTokens: 0.0004,
    rationale: 'Needs good natural language and tool calling capabilities'
  },

  /**
   * Evaluator - Logic and validation
   * Uses GPT-4o mini for rule checking
   */
  evaluator: {
    model: process.env.EVALUATOR_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 500,
    costPer1KTokens: 0.0004,
    rationale: 'Primarily logic-based, can use faster/cheaper model'
  },

  /**
   * Critic - Quality control and boundary checking
   * Uses GPT-4o mini for quick checks
   */
  critic: {
    model: process.env.CRITIC_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    maxTokens: 500,
    costPer1KTokens: 0.0004,
    rationale: 'Fast quality checks, boundary enforcement'
  },

  /**
   * Summary Generator - Creates conversation summaries
   * Uses GPT-4o mini for natural language summaries
   */
  summary: {
    model: process.env.SUMMARY_MODEL || 'gpt-4o-mini',
    temperature: 0.5,
    maxTokens: 800,
    costPer1KTokens: 0.0004,
    rationale: 'Needs good summarization capabilities'
  }
};

/**
 * Get model config for an agent
 */
export function getAgentModelConfig(agentType: string): AgentModelConfig {
  return AGENT_MODEL_CONFIG[agentType] || AGENT_MODEL_CONFIG.worker;
}

/**
 * Calculate cost for token usage
 */
export function calculateAgentCost(agentType: string, tokensUsed: number): number {
  const config = getAgentModelConfig(agentType);
  return Math.round((tokensUsed / 1000) * config.costPer1KTokens * 100); // Return in cents
}

/**
 * Get recommended model for a task complexity
 */
export function getModelForComplexity(complexity: 'simple' | 'medium' | 'complex'): string {
  const modelMap = {
    simple: process.env.SIMPLE_MODEL || 'gpt-4o-mini',
    medium: process.env.MEDIUM_MODEL || 'gpt-4o-mini',
    complex: process.env.COMPLEX_MODEL || 'gpt-4o' // Keep GPT-4o for complex tasks
  };
  return modelMap[complexity];
}

/**
 * Override model config at runtime
 */
export function setAgentModel(agentType: string, model: string, temperature?: number): void {
  if (AGENT_MODEL_CONFIG[agentType]) {
    AGENT_MODEL_CONFIG[agentType].model = model;
    if (temperature !== undefined) {
      AGENT_MODEL_CONFIG[agentType].temperature = temperature;
    }
  }
}
