/**
 * DAG Loader Service
 * Loads and validates DAG configuration from dag.json
 * @module orchestrator/langgraph/dag-loader
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { DAGConfiguration } from './dag-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * DAG Loader Service
 * Singleton service to load and cache DAG configuration
 */
export class DAGLoaderService {
  private static instance: DAGLoaderService | null = null;
  private dagConfig: DAGConfiguration | null = null;
  private loaded: boolean = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DAGLoaderService {
    if (!DAGLoaderService.instance) {
      DAGLoaderService.instance = new DAGLoaderService();
    }
    return DAGLoaderService.instance;
  }

  /**
   * Load DAG configuration from dag.json
   */
  async loadDAGConfig(): Promise<DAGConfiguration> {
    if (this.loaded && this.dagConfig) {
      return this.dagConfig;
    }

    try {
      console.log('[DAG Loader] 📂 Loading DAG configuration from dag.json...');

      // dag.json is now at orchestrator root level (moved from agents/)
      const dagJsonPath = join(__dirname, '../dag.json');
      const dagJsonContent = await fs.readFile(dagJsonPath, 'utf-8');
      const config = JSON.parse(dagJsonContent) as DAGConfiguration;

      // Validate configuration
      this.validateDAGConfig(config);

      this.dagConfig = config;
      this.loaded = true;

      console.log(`[DAG Loader] ✅ DAG loaded: ${config.nodes.length} nodes`);
      console.log(`[DAG Loader] Entry node: ${config.graph_config.entry_node}`);
      console.log(`[DAG Loader] Mandatory fields: ${config.graph_config.mandatory_fields.join(', ')}`);
      console.log(`[DAG Loader] Flags defined: ${Object.keys(config.routing_config.flag_definitions).length}`);

      return config;
    } catch (error: any) {
      console.error('[DAG Loader] ❌ Failed to load DAG configuration:', error.message);
      throw new Error(`DAG configuration load failed: ${error.message}`);
    }
  }

  /**
   * Validate DAG configuration structure
   */
  private validateDAGConfig(config: DAGConfiguration): void {
    // Check required top-level properties
    if (!config.nodes || !Array.isArray(config.nodes)) {
      throw new Error('DAG config missing or invalid "nodes" array');
    }

    if (!config.global_context_schema) {
      throw new Error('DAG config missing "global_context_schema"');
    }

    if (!config.routing_config) {
      throw new Error('DAG config missing "routing_config"');
    }

    if (!config.graph_config) {
      throw new Error('DAG config missing "graph_config"');
    }

    // Validate nodes
    const nodeNames = new Set<string>();
    for (const node of config.nodes) {
      if (!node.node_name) {
        throw new Error('Node missing "node_name"');
      }

      if (nodeNames.has(node.node_name)) {
        throw new Error(`Duplicate node name: ${node.node_name}`);
      }

      nodeNames.add(node.node_name);

      if (!node.prompt_templates) {
        throw new Error(`Node ${node.node_name} missing "prompt_templates"`);
      }

      if (!node.node_goal) {
        throw new Error(`Node ${node.node_name} missing "node_goal"`);
      }
    }

    // Validate entry node exists
    if (!nodeNames.has(config.graph_config.entry_node)) {
      throw new Error(`Entry node "${config.graph_config.entry_node}" not found in nodes`);
    }

    // Validate branching targets exist
    for (const node of config.nodes) {
      if (node.default_next_node && !nodeNames.has(node.default_next_node)) {
        throw new Error(
          `Node ${node.node_name} has invalid default_next_node: ${node.default_next_node}`
        );
      }

      for (const branch of node.branching_conditions) {
        if (!nodeNames.has(branch.child_node)) {
          throw new Error(
            `Node ${node.node_name} has invalid branch target: ${branch.child_node}`
          );
        }
      }
    }

    console.log('[DAG Loader] ✅ DAG configuration validation passed');
  }

  /**
   * Get node by name
   */
  getNode(nodeName: string): any {
    if (!this.dagConfig) {
      throw new Error('DAG config not loaded. Call loadDAGConfig() first.');
    }

    const node = this.dagConfig.nodes.find((n) => n.node_name === nodeName);
    if (!node) {
      throw new Error(`Node not found: ${nodeName}`);
    }

    return node;
  }

  /**
   * Get all nodes
   */
  getAllNodes(): any[] {
    if (!this.dagConfig) {
      throw new Error('DAG config not loaded. Call loadDAGConfig() first.');
    }

    return this.dagConfig.nodes;
  }

  /**
   * Get routing config
   */
  getRoutingConfig() {
    if (!this.dagConfig) {
      throw new Error('DAG config not loaded. Call loadDAGConfig() first.');
    }

    return this.dagConfig.routing_config;
  }

  /**
   * Get graph config
   */
  getGraphConfig() {
    if (!this.dagConfig) {
      throw new Error('DAG config not loaded. Call loadDAGConfig() first.');
    }

    return this.dagConfig.graph_config;
  }

  /**
   * Get context schema
   */
  getContextSchema() {
    if (!this.dagConfig) {
      throw new Error('DAG config not loaded. Call loadDAGConfig() first.');
    }

    return this.dagConfig.global_context_schema;
  }

  /**
   * Get system config
   */
  getSystemConfig() {
    if (!this.dagConfig) {
      throw new Error('DAG config not loaded. Call loadDAGConfig() first.');
    }

    return this.dagConfig.system_config || {
      agent_identity: 'You are a polite customer service agent who is assisting a customer',
      default_context_values: {
        who_are_you: 'You are a polite customer service agent who is assisting a customer',
      },
    };
  }

  /**
   * Get full DAG config
   */
  getDAGConfig(): DAGConfiguration {
    if (!this.dagConfig) {
      throw new Error('DAG config not loaded. Call loadDAGConfig() first.');
    }

    return this.dagConfig;
  }

  /**
   * Reload DAG configuration (for development/testing)
   */
  async reload(): Promise<DAGConfiguration> {
    this.loaded = false;
    this.dagConfig = null;
    return this.loadDAGConfig();
  }
}

/**
 * Singleton accessor
 */
export function getDAGLoader(): DAGLoaderService {
  return DAGLoaderService.getInstance();
}
