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
   * Uses mid-tier model for intent detection and coordination
   */
  orchestrator: {
    model: process.env.ORCHESTRATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 1000,
    costPer1KTokens: 0.0015,
    rationale: 'Needs good reasoning for intent detection and workflow coordination'
  },

  /**
   * Worker - Does most of the heavy lifting
   * Uses capable model for natural language and tool use
   */
  worker: {
    model: process.env.WORKER_MODEL || 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1500,
    costPer1KTokens: 0.0015,
    rationale: 'Needs good natural language and tool calling capabilities'
  },

  /**
   * Evaluator - Logic and validation
   * Can use smaller/faster model for rule checking
   */
  evaluator: {
    model: process.env.EVALUATOR_MODEL || 'gpt-3.5-turbo',
    temperature: 0.1,
    maxTokens: 500,
    costPer1KTokens: 0.0015,
    rationale: 'Primarily logic-based, can use faster/cheaper model'
  },

  /**
   * Critic - Quality control and boundary checking
   * Uses small, fast model for quick checks
   */
  critic: {
    model: process.env.CRITIC_MODEL || 'gpt-3.5-turbo',
    temperature: 0.2,
    maxTokens: 500,
    costPer1KTokens: 0.0015,
    rationale: 'Fast quality checks, boundary enforcement'
  },

  /**
   * Summary Generator - Creates conversation summaries
   * Uses capable model for good natural language
   */
  summary: {
    model: process.env.SUMMARY_MODEL || 'gpt-3.5-turbo',
    temperature: 0.5,
    maxTokens: 800,
    costPer1KTokens: 0.0015,
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
    simple: process.env.SIMPLE_MODEL || 'gpt-3.5-turbo',
    medium: process.env.MEDIUM_MODEL || 'gpt-3.5-turbo',
    complex: process.env.COMPLEX_MODEL || 'gpt-4-turbo-preview'
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
