/**
 * Circuit Breaker Service
 * Prevents cascading failures and infinite loops in agent execution
 * @module orchestrator/state/circuit-breaker
 */

import { StateManager } from './state-manager.service.js';

/**
 * Circuit States
 */
export enum CircuitState {
  CLOSED = 'closed',   // Normal operation
  OPEN = 'open',       // Failing - block all requests
  HALF_OPEN = 'half_open', // Testing recovery
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  timeoutMs: number;             // Time to wait before half-open
  successThreshold: number;      // Consecutive successes to close
}

/**
 * Default configurations per agent type
 */
const DEFAULT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  planner: {
    failureThreshold: 3,
    timeoutMs: 60000, // 60 seconds
    successThreshold: 2,
  },
  worker: {
    failureThreshold: 5,
    timeoutMs: 30000, // 30 seconds
    successThreshold: 3,
  },
  critic: {
    failureThreshold: 3,
    timeoutMs: 60000,
    successThreshold: 2,
  },
  summarizer: {
    failureThreshold: 3,
    timeoutMs: 60000,
    successThreshold: 2,
  },
  orchestrator: {
    failureThreshold: 10,
    timeoutMs: 120000, // 2 minutes
    successThreshold: 5,
  },
};

/**
 * Circuit Breaker State
 */
interface CircuitBreakerState {
  sessionId: string;
  agentType: string;
  circuitState: CircuitState;
  failureCount: number;
  lastFailureTs?: Date;
  openedTs?: Date;
  lastSuccessTs?: Date;
  consecutiveSuccesses: number;
  config: CircuitBreakerConfig;
}

/**
 * Circuit Breaker Service
 */
export class CircuitBreakerService {
  private stateManager: StateManager;
  private circuits: Map<string, CircuitBreakerState> = new Map();

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Get circuit key
   */
  private getCircuitKey(sessionId: string, agentType: string): string {
    return `${sessionId}:${agentType}`;
  }

  /**
   * Get or create circuit breaker state
   */
  private async getCircuit(
    sessionId: string,
    agentType: string
  ): Promise<CircuitBreakerState> {
    const key = this.getCircuitKey(sessionId, agentType);

    // Check in-memory cache first
    if (this.circuits.has(key)) {
      return this.circuits.get(key)!;
    }

    // Try loading from database
    try {
      const dbCircuit = await this.stateManager.getCircuitBreakerState(
        sessionId,
        agentType
      );

      if (dbCircuit) {
        const state: CircuitBreakerState = {
          sessionId,
          agentType,
          circuitState: dbCircuit.circuit_state as CircuitState,
          failureCount: dbCircuit.failure_count,
          lastFailureTs: dbCircuit.last_failure_ts,
          openedTs: dbCircuit.opened_ts,
          lastSuccessTs: dbCircuit.last_success_ts,
          consecutiveSuccesses: dbCircuit.consecutive_successes,
          config: DEFAULT_CONFIGS[agentType] || DEFAULT_CONFIGS.orchestrator,
        };

        this.circuits.set(key, state);
        return state;
      }
    } catch (error: any) {
      console.warn(`[CircuitBreaker] Could not load from DB: ${error.message}`);
    }

    // Create new circuit
    const newCircuit: CircuitBreakerState = {
      sessionId,
      agentType,
      circuitState: CircuitState.CLOSED,
      failureCount: 0,
      consecutiveSuccesses: 0,
      config: DEFAULT_CONFIGS[agentType] || DEFAULT_CONFIGS.orchestrator,
    };

    this.circuits.set(key, newCircuit);
    await this.saveCircuit(newCircuit);

    return newCircuit;
  }

  /**
   * Save circuit state to database
   */
  private async saveCircuit(circuit: CircuitBreakerState): Promise<void> {
    try {
      await this.stateManager.updateCircuitBreakerState(
        circuit.sessionId,
        circuit.agentType,
        {
          circuit_state: circuit.circuitState,
          failure_count: circuit.failureCount,
          last_failure_ts: circuit.lastFailureTs,
          opened_ts: circuit.openedTs,
          last_success_ts: circuit.lastSuccessTs,
          consecutive_successes: circuit.consecutiveSuccesses,
          failure_threshold: circuit.config.failureThreshold,
          timeout_ms: circuit.config.timeoutMs,
        }
      );
    } catch (error: any) {
      console.error(`[CircuitBreaker] Failed to save state: ${error.message}`);
    }
  }

  /**
   * Check if circuit is open (blocking requests)
   */
  async isOpen(sessionId: string, agentType: string): Promise<boolean> {
    const circuit = await this.getCircuit(sessionId, agentType);

    // If circuit is closed, allow requests
    if (circuit.circuitState === CircuitState.CLOSED) {
      return false;
    }

    // If circuit is open, check if timeout has elapsed
    if (circuit.circuitState === CircuitState.OPEN) {
      if (!circuit.openedTs) {
        return true;
      }

      const now = Date.now();
      const openedTime = circuit.openedTs.getTime();
      const elapsedMs = now - openedTime;

      // If timeout elapsed, transition to half-open
      if (elapsedMs >= circuit.config.timeoutMs) {
        console.log(
          `[CircuitBreaker] ${agentType} transitioning to HALF_OPEN after ${elapsedMs}ms`
        );
        circuit.circuitState = CircuitState.HALF_OPEN;
        circuit.consecutiveSuccesses = 0;
        await this.saveCircuit(circuit);
        return false;
      }

      // Still in timeout period
      return true;
    }

    // Half-open - allow limited requests
    return false;
  }

  /**
   * Record success
   */
  async recordSuccess(sessionId: string, agentType: string): Promise<void> {
    const circuit = await this.getCircuit(sessionId, agentType);

    circuit.lastSuccessTs = new Date();
    circuit.consecutiveSuccesses++;
    circuit.failureCount = 0; // Reset failure count on success

    // If half-open and enough successes, close the circuit
    if (circuit.circuitState === CircuitState.HALF_OPEN) {
      if (circuit.consecutiveSuccesses >= circuit.config.successThreshold) {
        console.log(
          `[CircuitBreaker] ${agentType} closing circuit after ${circuit.consecutiveSuccesses} successes`
        );
        circuit.circuitState = CircuitState.CLOSED;
        circuit.consecutiveSuccesses = 0;
        circuit.openedTs = undefined;
      }
    }

    await this.saveCircuit(circuit);
  }

  /**
   * Record failure
   */
  async recordFailure(
    sessionId: string,
    agentType: string,
    error: Error
  ): Promise<void> {
    const circuit = await this.getCircuit(sessionId, agentType);

    circuit.lastFailureTs = new Date();
    circuit.failureCount++;
    circuit.consecutiveSuccesses = 0;

    console.log(
      `[CircuitBreaker] ${agentType} failure #${circuit.failureCount}: ${error.message}`
    );

    // Check if threshold exceeded
    if (circuit.failureCount >= circuit.config.failureThreshold) {
      console.log(
        `[CircuitBreaker] ${agentType} opening circuit after ${circuit.failureCount} failures`
      );
      circuit.circuitState = CircuitState.OPEN;
      circuit.openedTs = new Date();
    }

    await this.saveCircuit(circuit);
  }

  /**
   * Reset circuit breaker
   */
  async reset(sessionId: string, agentType: string): Promise<void> {
    const circuit = await this.getCircuit(sessionId, agentType);

    circuit.circuitState = CircuitState.CLOSED;
    circuit.failureCount = 0;
    circuit.consecutiveSuccesses = 0;
    circuit.openedTs = undefined;
    circuit.lastFailureTs = undefined;

    console.log(`[CircuitBreaker] ${agentType} circuit reset`);

    await this.saveCircuit(circuit);
  }

  /**
   * Get circuit state summary
   */
  async getState(
    sessionId: string,
    agentType: string
  ): Promise<{
    state: CircuitState;
    failureCount: number;
    consecutiveSuccesses: number;
    isOpen: boolean;
  }> {
    const circuit = await this.getCircuit(sessionId, agentType);
    const isOpen = await this.isOpen(sessionId, agentType);

    return {
      state: circuit.circuitState,
      failureCount: circuit.failureCount,
      consecutiveSuccesses: circuit.consecutiveSuccesses,
      isOpen,
    };
  }

  /**
   * Get all circuit states for session
   */
  async getAllCircuits(sessionId: string): Promise<
    Array<{
      agentType: string;
      state: CircuitState;
      failureCount: number;
      isOpen: boolean;
    }>
  > {
    const agentTypes = ['planner', 'worker', 'critic', 'summarizer', 'orchestrator'];
    const results = [];

    for (const agentType of agentTypes) {
      const state = await this.getState(sessionId, agentType);
      results.push({
        agentType,
        state: state.state,
        failureCount: state.failureCount,
        isOpen: state.isOpen,
      });
    }

    return results;
  }

  /**
   * Check if any circuit is open for session
   */
  async anyCircuitOpen(sessionId: string): Promise<boolean> {
    const circuits = await this.getAllCircuits(sessionId);
    return circuits.some(c => c.isOpen);
  }

  /**
   * Clear all in-memory cache
   * Should be called when session ends
   */
  clearCache(sessionId: string): void {
    const agentTypes = ['planner', 'worker', 'critic', 'summarizer', 'orchestrator'];
    for (const agentType of agentTypes) {
      const key = this.getCircuitKey(sessionId, agentType);
      this.circuits.delete(key);
    }
  }
}

/**
 * Singleton instance (optional - can also be instantiated per orchestrator)
 */
let instance: CircuitBreakerService | null = null;

export function getCircuitBreakerService(
  stateManager: StateManager
): CircuitBreakerService {
  if (!instance) {
    instance = new CircuitBreakerService(stateManager);
  }
  return instance;
}
