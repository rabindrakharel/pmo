/**
 * DAG Loader Service
 * Loads DAG configuration from dag.json file
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DAGConfiguration } from './dag-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DAGLoader {
  private dagConfig: DAGConfiguration | null = null;
  private dagPath: string;

  constructor(dagPath?: string) {
    // Default to dag.json in parent directory (orchestrator/)
    this.dagPath = dagPath || join(__dirname, '..', 'dag.json');
  }

  /**
   * Load DAG configuration from file
   */
  async loadDAGConfig(): Promise<DAGConfiguration> {
    if (this.dagConfig) {
      return this.dagConfig;
    }

    try {
      const dagContent = await readFile(this.dagPath, 'utf-8');
      this.dagConfig = JSON.parse(dagContent) as DAGConfiguration;

      console.log(`[DAGLoader] ✅ Loaded DAG config from ${this.dagPath}`);
      console.log(`[DAGLoader] Entry node: ${this.dagConfig.graph_config.entry_node}`);
      console.log(`[DAGLoader] Total nodes: ${this.dagConfig.nodes.length}`);

      return this.dagConfig;
    } catch (error: any) {
      console.error(`[DAGLoader] ❌ Failed to load DAG config from ${this.dagPath}:`, error.message);
      throw new Error(`Failed to load DAG configuration: ${error.message}`);
    }
  }

  /**
   * Get node configuration by name
   */
  getNodeConfig(nodeName: string): DAGConfiguration['nodes'][0] | undefined {
    if (!this.dagConfig) {
      throw new Error('DAG config not loaded. Call loadDAGConfig() first.');
    }
    return this.dagConfig.nodes.find(node => node.node_name === nodeName);
  }

  /**
   * Get all node names
   */
  getAllNodeNames(): string[] {
    if (!this.dagConfig) {
      throw new Error('DAG config not loaded. Call loadDAGConfig() first.');
    }
    return this.dagConfig.nodes.map(node => node.node_name);
  }

  /**
   * Validate DAG configuration
   */
  validateDAG(): { valid: boolean; errors: string[] } {
    if (!this.dagConfig) {
      return { valid: false, errors: ['DAG config not loaded'] };
    }

    const errors: string[] = [];
    const nodeNames = new Set(this.dagConfig.nodes.map(n => n.node_name));

    // Check entry node exists
    if (!nodeNames.has(this.dagConfig.graph_config.entry_node)) {
      errors.push(`Entry node "${this.dagConfig.graph_config.entry_node}" not found in nodes`);
    }

    // Check all default_next_nodes exist
    for (const node of this.dagConfig.nodes) {
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
let instance: DAGLoader | null = null;

export function getDAGLoader(dagPath?: string): DAGLoader {
  if (!instance) {
    instance = new DAGLoader(dagPath);
  }
  return instance;
}
