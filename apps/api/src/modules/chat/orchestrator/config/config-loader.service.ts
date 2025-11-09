/**
 * Configuration Loader Service
 * Loads and validates agent configuration
 *
 * @module orchestrator/config/config-loader
 */

import fs from 'fs/promises';
import path from 'path';
import type { AgentConfigV3 } from './agent-config.schema.js';
import { validateAgentConfigV3 } from './agent-config.schema.js';

export class ConfigLoaderService {
  private config: AgentConfigV3 | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<AgentConfigV3> {
    console.log(`[ConfigLoader] Loading configuration from: ${this.configPath}`);

    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configContent);

      // Validate config
      const validation = validateAgentConfigV3(parsedConfig);
      if (!validation.valid) {
        console.error('[ConfigLoader] ❌ Config validation failed:');
        validation.errors.forEach(err => console.error(`  - ${err}`));
        throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
      }

      this.config = parsedConfig;
      console.log(`[ConfigLoader] ✅ Loaded config with ${parsedConfig.goals.length} goals`);

      return this.config;
    } catch (error: any) {
      console.error(`[ConfigLoader] ❌ Failed to load config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentConfigV3 {
    if (!this.config) {
      throw new Error('Config not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Get default config path
   */
  private getDefaultConfigPath(): string {
    return path.join(process.cwd(), 'apps/api/src/modules/chat/orchestrator/agent_config.json');
  }

  /**
   * Reload configuration
   */
  async reloadConfig(): Promise<AgentConfigV3> {
    console.log('[ConfigLoader] 🔄 Reloading configuration...');
    this.config = null;
    return await this.loadConfig();
  }
}

/**
 * Singleton instance
 */
let configLoaderInstance: ConfigLoaderService | null = null;

/**
 * Get or create config loader instance
 */
export function getConfigLoader(configPath?: string): ConfigLoaderService {
  if (!configLoaderInstance) {
    configLoaderInstance = new ConfigLoaderService(configPath);
  }
  return configLoaderInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetConfigLoader(): void {
  configLoaderInstance = null;
}
