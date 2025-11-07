/**
 * Agent Config Loader Service
 * Loads agent configuration from agent_config.json file
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DAGConfiguration } from './dag-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AgentConfigLoader {
  private agentConfig: DAGConfiguration | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    // Default to agent_config.json in parent directory (orchestrator/)
    this.configPath = configPath || join(__dirname, '..', 'agent_config.json');
  }

  /**
   * Load agent configuration from file
   */
  async loadAgentConfig(): Promise<DAGConfiguration> {
    if (this.agentConfig) {
      return this.agentConfig;
    }

    try {
      const configContent = await readFile(this.configPath, 'utf-8');
      this.agentConfig = JSON.parse(configContent) as DAGConfiguration;

      console.log(`[AgentConfigLoader] ✅ Loaded agent config from ${this.configPath}`);
      console.log(`[AgentConfigLoader] Total nodes: ${this.agentConfig.nodes.length}`);

      return this.agentConfig;
    } catch (error: any) {
      console.error(`[AgentConfigLoader] ❌ Failed to load agent config from ${this.configPath}:`, error.message);
      throw new Error(`Failed to load agent configuration: ${error.message}`);
    }
  }

  /**
   * Get node configuration by name
   */
  getNodeConfig(nodeName: string): DAGConfiguration['nodes'][0] | undefined {
    if (!this.agentConfig) {
      throw new Error('Agent config not loaded. Call loadAgentConfig() first.');
    }
    return this.agentConfig.nodes.find(node => node.node_name === nodeName);
  }

  /**
   * Get all node names
   */
  getAllNodeNames(): string[] {
    if (!this.agentConfig) {
      throw new Error('Agent config not loaded. Call loadAgentConfig() first.');
    }
    return this.agentConfig.nodes.map(node => node.node_name);
  }

  /**
   * Validate agent configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    if (!this.agentConfig) {
      return { valid: false, errors: ['Agent config not loaded'] };
    }

    const errors: string[] = [];
    const nodeNames = new Set(this.agentConfig.nodes.map(n => n.node_name));

    // Check all default_next_nodes exist
    for (const node of this.agentConfig.nodes) {
      if (node.default_next_node && !nodeNames.has(node.default_next_node)) {
        errors.push(`Node "${node.node_name}" references non-existent default_next_node: ${node.default_next_node}`);
      }

      // Check branching conditions
      if (node.branching_conditions) {
        for (const branch of node.branching_conditions) {
          if (!nodeNames.has(branch.child_node)) {
            errors.push(`Node "${node.node_name}" references non-existent child_node: ${branch.child_node}`);
          }
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
