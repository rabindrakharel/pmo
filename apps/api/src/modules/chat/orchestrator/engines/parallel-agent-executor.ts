/**
 * Parallel Agent Executor
 * Executes multiple agents in parallel based on execution strategy
 * Provides 50%+ performance improvement for independent agents
 *
 * @module orchestrator/engines/parallel-agent-executor
 * @version 1.0.0
 */

import type {
  AgentExecutionStrategy,
  ParallelAgentGroup,
  AgentExecutionNode
} from '../config/agent-config.schema.js';
import type { AgentContextState } from '../agents/agent-context.service.js';

export interface AgentExecutor {
  agentId: string;
  execute: (state: AgentContextState, userMessage?: string) => Promise<any>;
}

export interface ParallelExecutionResult {
  results: Map<string, any>;  // agentId → result
  errors: Map<string, Error>;  // agentId → error
  executionTimeMs: number;
  mode: 'sequential' | 'parallel' | 'dependency_graph';
}

export class ParallelAgentExecutor {
  /**
   * Execute agents based on strategy
   *
   * @param strategy - Execution strategy from goal config
   * @param agents - Map of available agents
   * @param state - Current conversation state
   * @param userMessage - Optional user message
   */
  async executeAgents(
    strategy: AgentExecutionStrategy,
    agents: Map<string, AgentExecutor>,
    state: AgentContextState,
    userMessage?: string
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();

    switch (strategy.mode) {
      case 'parallel':
        return await this.executeParallel(strategy.parallel_groups || [], agents, state, startTime, userMessage);

      case 'dependency_graph':
        return await this.executeDependencyGraph(strategy.execution_graph || [], agents, state, startTime, userMessage);

      case 'sequential':
      default:
        return await this.executeSequential(agents, state, startTime, userMessage);
    }
  }

  /**
   * Execute agents in parallel groups
   * Agents in same group run simultaneously, groups run sequentially
   */
  private async executeParallel(
    parallelGroups: ParallelAgentGroup[],
    agents: Map<string, AgentExecutor>,
    state: AgentContextState,
    startTime: number,
    userMessage?: string
  ): Promise<ParallelExecutionResult> {
    const results = new Map<string, any>();
    const errors = new Map<string, Error>();

    console.log(`\n⚡ [ParallelAgentExecutor] Executing ${parallelGroups.length} parallel groups`);

    for (const group of parallelGroups) {
      console.log(`   Group: ${group.description || 'Unnamed'} (${group.agents.length} agents)`);

      // Execute all agents in group simultaneously
      const groupExecutions = group.agents.map(async (agentId) => {
        const agent = agents.get(agentId);
        if (!agent) {
          console.warn(`   ⚠️  Agent not found: ${agentId}`);
          return { agentId, result: null, error: new Error(`Agent not found: ${agentId}`) };
        }

        try {
          console.log(`   ▶️  Starting: ${agentId}`);
          const execStart = Date.now();
          const result = await agent.execute(state, userMessage);
          const execTime = Date.now() - execStart;
          console.log(`   ✅ Completed: ${agentId} (${execTime}ms)`);
          return { agentId, result, error: null };
        } catch (error: any) {
          console.error(`   ❌ Failed: ${agentId} - ${error.message}`);
          return { agentId, result: null, error };
        }
      });

      // Wait for all agents in group to finish
      const groupResults = await Promise.allSettled(groupExecutions);

      // Collect results and errors
      for (const settledResult of groupResults) {
        if (settledResult.status === 'fulfilled') {
          const { agentId, result, error } = settledResult.value;
          if (error) {
            errors.set(agentId, error);
          } else {
            results.set(agentId, result);
          }
        }
      }
    }

    const executionTimeMs = Date.now() - startTime;
    console.log(`\n   Total execution time: ${executionTimeMs}ms`);

    return {
      results,
      errors,
      executionTimeMs,
      mode: 'parallel'
    };
  }

  /**
   * Execute agents based on dependency graph
   * Agents with no dependencies run first, then agents that depend on them
   */
  private async executeDependencyGraph(
    executionGraph: AgentExecutionNode[],
    agents: Map<string, AgentExecutor>,
    state: AgentContextState,
    startTime: number,
    userMessage?: string
  ): Promise<ParallelExecutionResult> {
    const results = new Map<string, any>();
    const errors = new Map<string, Error>();
    const completed = new Set<string>();

    console.log(`\n📊 [ParallelAgentExecutor] Executing dependency graph (${executionGraph.length} nodes)`);

    // Build execution waves (agents that can run in parallel at each stage)
    const waves = this.buildExecutionWaves(executionGraph);

    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
      const wave = waves[waveIndex];
      console.log(`\n   Wave ${waveIndex + 1}: ${wave.map(n => n.agent).join(', ')}`);

      // Execute all nodes in this wave simultaneously
      const waveExecutions = wave.map(async (node) => {
        const agent = agents.get(node.agent);
        if (!agent) {
          console.warn(`   ⚠️  Agent not found: ${node.agent}`);
          return { agentId: node.agent, result: null, error: new Error(`Agent not found: ${node.agent}`) };
        }

        try {
          console.log(`   ▶️  Starting: ${node.agent}`);
          const execStart = Date.now();
          const result = await agent.execute(state, userMessage);
          const execTime = Date.now() - execStart;
          console.log(`   ✅ Completed: ${node.agent} (${execTime}ms)`);
          completed.add(node.agent);
          return { agentId: node.agent, result, error: null, required: node.required };
        } catch (error: any) {
          console.error(`   ❌ Failed: ${node.agent} - ${error.message}`);
          return { agentId: node.agent, result: null, error, required: node.required };
        }
      });

      // Wait for all agents in wave to finish
      const waveResults = await Promise.allSettled(waveExecutions);

      // Collect results and check for required failures
      for (const settledResult of waveResults) {
        if (settledResult.status === 'fulfilled') {
          const { agentId, result, error, required } = settledResult.value;

          if (error) {
            errors.set(agentId, error);
            // If required agent failed, stop execution
            if (required) {
              console.error(`\n   🛑 Required agent failed: ${agentId}, stopping execution`);
              const executionTimeMs = Date.now() - startTime;
              return { results, errors, executionTimeMs, mode: 'dependency_graph' };
            }
          } else {
            results.set(agentId, result);
          }
        }
      }
    }

    const executionTimeMs = Date.now() - startTime;
    console.log(`\n   Total execution time: ${executionTimeMs}ms`);

    return {
      results,
      errors,
      executionTimeMs,
      mode: 'dependency_graph'
    };
  }

  /**
   * Execute agents sequentially (fallback/default behavior)
   */
  private async executeSequential(
    agents: Map<string, AgentExecutor>,
    state: AgentContextState,
    startTime: number,
    userMessage?: string
  ): Promise<ParallelExecutionResult> {
    const results = new Map<string, any>();
    const errors = new Map<string, Error>();

    console.log(`\n🔄 [ParallelAgentExecutor] Executing ${agents.size} agents sequentially`);

    for (const [agentId, agent] of agents.entries()) {
      try {
        console.log(`   ▶️  Executing: ${agentId}`);
        const execStart = Date.now();
        const result = await agent.execute(state, userMessage);
        const execTime = Date.now() - execStart;
        console.log(`   ✅ Completed: ${agentId} (${execTime}ms)`);
        results.set(agentId, result);
      } catch (error: any) {
        console.error(`   ❌ Failed: ${agentId} - ${error.message}`);
        errors.set(agentId, error);
      }
    }

    const executionTimeMs = Date.now() - startTime;
    console.log(`\n   Total execution time: ${executionTimeMs}ms`);

    return {
      results,
      errors,
      executionTimeMs,
      mode: 'sequential'
    };
  }

  /**
   * Build execution waves based on dependency graph
   * Each wave contains nodes that can run in parallel
   */
  private buildExecutionWaves(executionGraph: AgentExecutionNode[]): AgentExecutionNode[][] {
    const waves: AgentExecutionNode[][] = [];
    const remaining = new Set(executionGraph.map(n => n.agent));
    const completed = new Set<string>();

    while (remaining.size > 0) {
      const wave: AgentExecutionNode[] = [];

      // Find nodes whose dependencies are all completed
      for (const node of executionGraph) {
        if (remaining.has(node.agent)) {
          const dependenciesMet = !node.depends_on || node.depends_on.every(dep => completed.has(dep));

          if (dependenciesMet) {
            wave.push(node);
            remaining.delete(node.agent);
          }
        }
      }

      if (wave.length === 0) {
        // Circular dependency detected or invalid graph
        console.error('[ParallelAgentExecutor] ❌ Circular dependency detected in execution graph');
        console.error(`   Remaining nodes: ${Array.from(remaining).join(', ')}`);
        break;
      }

      waves.push(wave);

      // Mark wave nodes as completed for next iteration
      wave.forEach(node => completed.add(node.agent));
    }

    return waves;
  }
}

/**
 * Factory function to create ParallelAgentExecutor
 */
export function createParallelAgentExecutor(): ParallelAgentExecutor {
  return new ParallelAgentExecutor();
}
