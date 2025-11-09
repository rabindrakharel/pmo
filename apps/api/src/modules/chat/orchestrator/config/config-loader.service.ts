/**
 * Configuration Loader Service
 * Loads and validates agent configuration (supports both v2 and v3)
 * Provides feature flag support for gradual rollout
 *
 * @module orchestrator/config/config-loader
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import type { AgentConfigV3 } from './agent-config.schema.js';
import { isAgentConfigV3, validateAgentConfigV3 } from './agent-config.schema.js';

export interface ConfigLoaderOptions {
  useV3: boolean;  // Feature flag: Use v3 goal-based config
  configPath?: string;  // Custom config path
  enableHotReload?: boolean;  // Watch for config changes
}

export class ConfigLoaderService {
  private config: AgentConfigV3 | any;
  private configVersion: '2.x' | '3.0.0';
  private configPath: string;
  private options: ConfigLoaderOptions;

  constructor(options: ConfigLoaderOptions = { useV3: false }) {
    this.options = options;
    this.configPath = options.configPath || this.getDefaultConfigPath();
    this.config = null;
    this.configVersion = options.useV3 ? '3.0.0' : '2.x';
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<AgentConfigV3 | any> {
    console.log(`[ConfigLoader] Loading configuration from: ${this.configPath}`);
    console.log(`[ConfigLoader] Target version: ${this.configVersion}`);

    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configContent);

      // Check if it's v3 config
      if (isAgentConfigV3(parsedConfig)) {
        console.log('[ConfigLoader] ✅ Detected v3.0.0 config');

        // Validate v3 config
        const validation = validateAgentConfigV3(parsedConfig);
        if (!validation.valid) {
          console.error('[ConfigLoader] ❌ v3 config validation failed:');
          validation.errors.forEach(err => console.error(`  - ${err}`));
          throw new Error(`Invalid v3 config: ${validation.errors.join(', ')}`);
        }

        this.config = parsedConfig;
        this.configVersion = '3.0.0';
        console.log(`[ConfigLoader] ✅ Loaded v3 config with ${parsedConfig.goals.length} goals`);
      } else {
        console.log('[ConfigLoader] ✅ Detected v2.x config');
        this.config = parsedConfig;
        this.configVersion = '2.x';
        console.log(`[ConfigLoader] ✅ Loaded v2 config with ${parsedConfig.nodes?.length || 0} nodes`);
      }

      return this.config;
    } catch (error: any) {
      console.error(`[ConfigLoader] ❌ Failed to load config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentConfigV3 | any {
    if (!this.config) {
      throw new Error('Config not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Get configuration version
   */
  getConfigVersion(): '2.x' | '3.0.0' {
    return this.configVersion;
  }

  /**
   * Check if using v3 config
   */
  isV3(): boolean {
    return this.configVersion === '3.0.0';
  }

  /**
   * Get default config path based on feature flag
   */
  private getDefaultConfigPath(): string {
    const configDir = path.join(process.cwd(), 'apps/api/src/modules/chat/orchestrator');

    if (this.options.useV3) {
      return path.join(configDir, 'agent_config_v3.json');
    } else {
      return path.join(configDir, 'agent_config.json');
    }
  }

  /**
   * Reload configuration (useful for development)
   */
  async reloadConfig(): Promise<AgentConfigV3 | any> {
    console.log('[ConfigLoader] 🔄 Reloading configuration...');
    this.config = null;
    return await this.loadConfig();
  }

  /**
   * Enable hot reload (watch for config file changes)
   */
  enableHotReload(callback?: (config: AgentConfigV3 | any) => void): void {
    if (!this.options.enableHotReload) {
      console.log('[ConfigLoader] Hot reload not enabled in options');
      return;
    }

    console.log('[ConfigLoader] 🔥 Hot reload enabled');

    // Watch config file for changes
    fs.watch(this.configPath, async (eventType) => {
      if (eventType === 'change') {
        console.log('[ConfigLoader] 📝 Config file changed, reloading...');
        try {
          const newConfig = await this.reloadConfig();
          if (callback) {
            callback(newConfig);
          }
        } catch (error: any) {
          console.error(`[ConfigLoader] ❌ Failed to reload config: ${error.message}`);
        }
      }
    });
  }
}

/**
 * Singleton instance for global access
 */
let configLoaderInstance: ConfigLoaderService | null = null;

/**
 * Get or create config loader instance
 */
export function getConfigLoader(options?: ConfigLoaderOptions): ConfigLoaderService {
  if (!configLoaderInstance) {
    // Check environment variable for feature flag
    const useV3FromEnv = process.env.USE_AGENT_CONFIG_V3 === 'true';
    const finalOptions = options || { useV3: useV3FromEnv };

    configLoaderInstance = new ConfigLoaderService(finalOptions);
  }
  return configLoaderInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetConfigLoader(): void {
  configLoaderInstance = null;
}
