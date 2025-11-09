/**
 * Agent Config Loader Service
 * Loads agent configuration from agent_config.json file (goal-based)
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AgentConfigV3, ConversationGoal } from '../config/agent-config.schema.js';
import { validateAgentConfigV3 } from '../config/agent-config.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AgentConfigLoader {
  private agentConfig: AgentConfigV3 | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    // Default to agent_config.json in parent directory (orchestrator/)
    this.configPath = configPath || join(__dirname, '..', 'agent_config.json');
  }

  /**
   * Load agent configuration from file
   */
  async loadAgentConfig(): Promise<AgentConfigV3> {
    if (this.agentConfig) {
      return this.agentConfig;
    }

    try {
      const configContent = await readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configContent) as AgentConfigV3;

      // Validate configuration
      const validation = validateAgentConfigV3(parsedConfig);
      if (!validation.valid) {
        console.error(`[AgentConfigLoader] ❌ Config validation failed:`);
        validation.errors.forEach(err => console.error(`  - ${err}`));
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      this.agentConfig = parsedConfig;

      console.log(`[AgentConfigLoader] ✅ Loaded agent config from ${this.configPath}`);
      console.log(`[AgentConfigLoader] Total goals: ${this.agentConfig.goals.length}`);
      console.log(`[AgentConfigLoader] Agent profiles: ${Object.keys(this.agentConfig.agent_profiles).join(', ')}`);

      return this.agentConfig;
    } catch (error: any) {
      console.error(`[AgentConfigLoader] ❌ Failed to load agent config from ${this.configPath}:`, error.message);
      throw new Error(`Failed to load agent configuration: ${error.message}`);
    }
  }

  /**
   * Get goal configuration by ID
   */
  getGoalConfig(goalId: string): ConversationGoal | undefined {
    if (!this.agentConfig) {
      throw new Error('Agent config not loaded. Call loadAgentConfig() first.');
    }
    return this.agentConfig.goals.find(goal => goal.goal_id === goalId);
  }

  /**
   * Get all goal IDs
   */
  getAllGoalIds(): string[] {
    if (!this.agentConfig) {
      throw new Error('Agent config not loaded. Call loadAgentConfig() first.');
    }
    return this.agentConfig.goals.map(goal => goal.goal_id);
  }

  /**
   * Get agent profile by ID
   */
  getAgentProfile(agentId: string) {
    if (!this.agentConfig) {
      throw new Error('Agent config not loaded. Call loadAgentConfig() first.');
    }
    return this.agentConfig.agent_profiles[agentId];
  }

  /**
   * Get conversation tactic by ID
   */
  getConversationTactic(tacticId: string) {
    if (!this.agentConfig) {
      throw new Error('Agent config not loaded. Call loadAgentConfig() first.');
    }
    return this.agentConfig.conversation_tactics[tacticId];
  }

  /**
   * Get the full configuration
   */
  getConfig(): AgentConfigV3 {
    if (!this.agentConfig) {
      throw new Error('Agent config not loaded. Call loadAgentConfig() first.');
    }
    return this.agentConfig;
  }

  /**
   * Validate agent configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    if (!this.agentConfig) {
      return { valid: false, errors: ['Agent config not loaded'] };
    }

    const errors: string[] = [];
    const goalIds = new Set(this.agentConfig.goals.map(g => g.goal_id));
    const agentIds = Object.keys(this.agentConfig.agent_profiles);

    // Check all advance conditions reference valid goals
    for (const goal of this.agentConfig.goals) {
      for (const condition of goal.auto_advance_conditions) {
        if (condition.next_goal !== 'END' && !goalIds.has(condition.next_goal)) {
          errors.push(`Goal "${goal.goal_id}" references non-existent next_goal: ${condition.next_goal}`);
        }
      }

      // Check allowed agents exist
      for (const agentId of goal.allowed_agents) {
        if (!agentIds.includes(agentId)) {
          errors.push(`Goal "${goal.goal_id}" references non-existent agent: ${agentId}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Singleton instance
 */
let instance: AgentConfigLoader | null = null;

export function getAgentConfigLoader(configPath?: string): AgentConfigLoader {
  if (!instance) {
    instance = new AgentConfigLoader(configPath);
  }
  return instance;
}
