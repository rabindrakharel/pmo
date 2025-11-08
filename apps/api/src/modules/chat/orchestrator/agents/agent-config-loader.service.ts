/**
 * DAG Loader Service
 * Loads and validates agent_config.json
 * @module orchestrator/agents/dag-loader
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DAGConfiguration } from './dag-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedDAGConfig: DAGConfiguration | null = null;

/**
 * Load DAG configuration from agent_config.json
 */
export async function loadDAGConfig(): Promise<DAGConfiguration> {
  if (cachedDAGConfig) {
    return cachedDAGConfig;
  }

  try {
    const configPath = path.join(__dirname, '../agent_config.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config: DAGConfiguration = JSON.parse(configContent);

    // Validate configuration
    if (!config.nodes || !Array.isArray(config.nodes)) {
      throw new Error('Invalid agent_config.json: nodes array is missing');
    }

    if (!config.AGENT_PROFILE) {
      throw new Error('Invalid agent_config.json: AGENT_PROFILE is missing');
    }

    console.log(`[DAGLoader] ✅ Loaded agent_config.json: ${config.nodes.length} nodes`);

    cachedDAGConfig = config;
    return config;
  } catch (error: any) {
    console.error(`[DAGLoader] ❌ Failed to load agent_config.json: ${error.message}`);
    throw error;
  }
}

/**
 * Get node definition by name
 */
export function getNodeByName(config: DAGConfiguration, nodeName: string): any | null {
  return config.nodes.find(n => n.node_name === nodeName) || null;
}

/**
 * Clear cached config (for testing)
 */
export function clearDAGCache(): void {
  cachedDAGConfig = null;
}
