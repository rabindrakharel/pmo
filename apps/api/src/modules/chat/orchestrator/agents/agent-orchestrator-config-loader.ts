/**
 * Agent Orchestrator Config Loader
 * Dynamically loads different agent configurations based on use case
 * @module chat/orchestrator/agents/agent-orchestrator-config-loader
 */

import customerServiceConfig from '../agent_config.json';
import projectTaskConfig from '../agent_config_projecttask.json';
import type { AgentConfig } from '../config/agent-config.schema.js';

/**
 * Available agent configurations
 */
export type AgentConfigType =
  | 'customer_service'      // Default: Customer service with booking automation
  | 'project_task_stakeholder'  // Project/task queries for stakeholders
  | 'custom';               // Custom config path

/**
 * Agent configuration registry
 */
const CONFIG_REGISTRY: Record<AgentConfigType, AgentConfig> = {
  customer_service: customerServiceConfig as AgentConfig,
  project_task_stakeholder: projectTaskConfig as AgentConfig,
  custom: customerServiceConfig as AgentConfig, // Fallback
};

/**
 * Load agent configuration by type
 */
export function loadAgentConfig(configType: AgentConfigType = 'customer_service'): AgentConfig {
  const config = CONFIG_REGISTRY[configType];

  if (!config) {
    console.warn(`[ConfigLoader] Unknown config type: ${configType}, falling back to customer_service`);
    return CONFIG_REGISTRY.customer_service;
  }

  console.log(`[ConfigLoader] Loaded config: ${configType} (${config.config_name || config.version})`);
  return config;
}

/**
 * Load custom agent configuration from path
 */
export async function loadCustomAgentConfig(configPath: string): Promise<AgentConfig> {
  try {
    const customConfig = await import(configPath);
    console.log(`[ConfigLoader] Loaded custom config from: ${configPath}`);
    return customConfig.default as AgentConfig;
  } catch (error) {
    console.error(`[ConfigLoader] Failed to load custom config from ${configPath}:`, error);
    throw new Error(`Failed to load custom agent config: ${error}`);
  }
}

/**
 * Get all available config types
 */
export function getAvailableConfigs(): Array<{ type: AgentConfigType; name: string; description: string }> {
  return [
    {
      type: 'customer_service',
      name: 'Customer Service Agent',
      description: 'Goal-oriented customer service with booking automation, MCP-driven session memory'
    },
    {
      type: 'project_task_stakeholder',
      name: 'Project & Task Stakeholder Agent',
      description: 'Conversational AI for project status, task tracking, budget monitoring'
    }
  ];
}

/**
 * Validate agent configuration structure
 */
export function validateAgentConfig(config: any): config is AgentConfig {
  // Basic validation
  if (!config.version || !config.architecture) {
    console.error('[ConfigLoader] Invalid config: missing version or architecture');
    return false;
  }

  if (!config.goals || !Array.isArray(config.goals) || config.goals.length === 0) {
    console.error('[ConfigLoader] Invalid config: missing or empty goals array');
    return false;
  }

  if (!config.agent_profiles) {
    console.error('[ConfigLoader] Invalid config: missing agent_profiles');
    return false;
  }

  console.log(`[ConfigLoader] Config validation passed: ${config.config_name || 'Unnamed'}`);
  return true;
}

/**
 * Get config metadata
 */
export function getConfigMetadata(configType: AgentConfigType): {
  version: string;
  name: string;
  description: string;
  goalCount: number;
  toolCount: number;
} {
  const config = loadAgentConfig(configType);

  // Count unique MCP tools across all goals
  const allTools = new Set<string>();
  config.goals.forEach(goal => {
    if (goal.mcp_tool_boundary) {
      goal.mcp_tool_boundary.forEach(tool => allTools.add(tool));
    }
  });

  return {
    version: config.version,
    name: config.config_name || 'Unnamed Config',
    description: config.description || '',
    goalCount: config.goals.length,
    toolCount: allTools.size
  };
}
