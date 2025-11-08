/**
 * Agent Factory
 * Creates universal agents configured for specific roles based on agent_config.json
 * @module orchestrator/agents/agent-factory
 */

import type { DAGConfiguration } from './dag-types.js';
import type { MCPAdapterService } from '../../mcp-adapter.service.js';
import { UniversalAgent, createUniversalAgent } from './universal-agent.service.js';

/**
 * Agent Factory
 * Single factory to create all agent types from universal template
 */
export class AgentFactory {
  private dagConfig: DAGConfiguration;
  private mcpAdapter?: MCPAdapterService;
  private authToken?: string;

  constructor(
    dagConfig: DAGConfiguration,
    mcpAdapter?: MCPAdapterService,
    authToken?: string
  ) {
    this.dagConfig = dagConfig;
    this.mcpAdapter = mcpAdapter;
    this.authToken = authToken;
  }

  /**
   * Create navigator agent
   * Validates conversation direction and decides next node
   */
  createNavigator(): UniversalAgent {
    return createUniversalAgent(
      this.dagConfig,
      'navigator',
      this.mcpAdapter,
      this.authToken
    );
  }

  /**
   * Create worker agent
   * Executes nodes and builds context
   */
  createWorker(): UniversalAgent {
    return createUniversalAgent(
      this.dagConfig,
      'worker',
      this.mcpAdapter,
      this.authToken
    );
  }

  /**
   * Create custom agent with specific profile
   */
  createCustomAgent(agentType: string): UniversalAgent {
    return createUniversalAgent(
      this.dagConfig,
      agentType,
      this.mcpAdapter,
      this.authToken
    );
  }

  /**
   * List available agent types from agent_config.json
   */
  getAvailableAgentTypes(): string[] {
    const agentProfiles = this.dagConfig.AGENT_PROFILE as any;
    const types: string[] = [];

    // Map profile keys to agent types
    const keyToType: Record<string, string> = {
      'node_navigator_agent': 'navigator',
      'worker_agent': 'worker',
    };

    for (const key of Object.keys(agentProfiles)) {
      if (keyToType[key]) {
        types.push(keyToType[key]);
      }
    }

    return types;
  }

  /**
   * Update auth token for all future agents
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }
}

/**
 * Create agent factory instance
 */
export function createAgentFactory(
  dagConfig: DAGConfiguration,
  mcpAdapter?: MCPAdapterService,
  authToken?: string
): AgentFactory {
  return new AgentFactory(dagConfig, mcpAdapter, authToken);
}
