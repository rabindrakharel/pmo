/**
 * State Manager Service
 * Manages persistent state for orchestrator sessions
 * Handles session creation, state variables, summaries, and agent logs
 * @module orchestrator/state/state-manager
 */

import { client } from '../../../../db/index.js';
import { v4 as uuidv4 } from 'uuid';

// Type definition for agent roles (formerly in intent-graph.types.ts)
type AgentRole = 'worker' | 'navigator' | 'guider' | 'planner';

/**
 * Orchestrator Session
 */
export interface OrchestratorSession {
  id: string;
  session_number: string;
  chat_session_id?: string;
  user_id?: string;
  tenant_id?: string;
  auth_metadata: Record<string, any>;
  current_intent?: string;
  current_node?: string;
  intent_graph_version: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  session_context: Record<string, any>;
  conversation_summary?: string;
  last_summary_ts?: Date;
  total_agent_calls: number;
  total_mcp_calls: number;
  total_tokens_used: number;
  total_cost_cents: number;
  created_ts: Date;
  updated_ts: Date;
  completed_ts?: Date;
}

/**
 * State Variable
 */
export interface StateVariable {
  id: string;
  session_id: string;
  key: string;
  value: any;
  value_type: string;
  source?: string;
  node_context?: string;
  validated: boolean;
  created_ts: Date;
  updated_ts: Date;
}

/**
 * Agent Log Entry
 */
export interface AgentLogEntry {
  id: string;
  session_id: string;
  agent_role: AgentRole;
  agent_action: string;
  node_context?: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  model_used?: string;
  tokens_used?: number;
  cost_cents?: number;
  mcp_tool_name?: string;
  mcp_tool_args?: Record<string, any>;
  mcp_tool_result?: Record<string, any>;
  mcp_success?: boolean;
  success: boolean;
  error_message?: string;
  natural_response?: string;
  duration_ms?: number;
  created_ts: Date;
}

/**
 * Conversation Summary
 */
export interface ConversationSummary {
  id: string;
  session_id: string;
  summary_type: 'full' | 'incremental' | 'node_completion';
  summary_text: string;
  up_to_node?: string;
  message_count?: number;
  model_used?: string;
  tokens_used?: number;
  created_ts: Date;
}

/**
 * State Manager Class
 */
export class StateManager {
  /**
   * Create a new orchestrator session
   */
  async createSession(args: {
    session_id?: string; // Optional: Use provided ID instead of generating new UUID
    chat_session_id?: string;
    user_id?: string;
    tenant_id?: string;
    auth_metadata?: Record<string, any>;
    initial_intent?: string;
    current_intent?: string; // Alias for initial_intent
    current_node?: string; // Initial node
    status?: 'active' | 'paused' | 'completed' | 'failed';
  }): Promise<OrchestratorSession> {
    const sessionId = args.session_id || uuidv4();
    const sessionNumber = await this.generateSessionNumber();
    const intent = args.current_intent || args.initial_intent;

    const result = await client`
      INSERT INTO app.orchestrator_session (
        id,
        session_number,
        chat_session_id,
        user_id,
        tenant_id,
        auth_metadata,
        current_intent,
        current_node,
        intent_graph_version,
        status,
        session_context
      ) VALUES (
        ${sessionId}::uuid,
        ${sessionNumber},
        ${args.chat_session_id || null}::uuid,
        ${args.user_id || null}::uuid,
        ${args.tenant_id || null}::uuid,
        ${JSON.stringify(args.auth_metadata || {})}::jsonb,
        ${intent || null},
        ${args.current_node || null},
        'v1.0',
        ${args.status || 'active'},
        '{}'::jsonb
      )
      RETURNING *
    `;

    return this.mapSession(result[0]);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<OrchestratorSession | null> {
    const result = await client`
      SELECT * FROM app.orchestrator_session
      WHERE id = ${sessionId}::uuid
    `;

    return result.length > 0 ? this.mapSession(result[0]) : null;
  }

  /**
   * Update session state
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<OrchestratorSession, 'id' | 'created_ts' | 'updated_ts'>>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.current_intent !== undefined) {
      setClauses.push(`current_intent = $${paramIndex++}`);
      values.push(updates.current_intent);
    }
    if (updates.current_node !== undefined) {
      setClauses.push(`current_node = $${paramIndex++}`);
      values.push(updates.current_node);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.session_context !== undefined) {
      setClauses.push(`session_context = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(updates.session_context));
    }
    if (updates.conversation_summary !== undefined) {
      setClauses.push(`conversation_summary = $${paramIndex++}`);
      values.push(updates.conversation_summary);
      setClauses.push(`last_summary_ts = now()`);
    }
    if (updates.total_agent_calls !== undefined) {
      setClauses.push(`total_agent_calls = $${paramIndex++}`);
      values.push(updates.total_agent_calls);
    }
    if (updates.total_mcp_calls !== undefined) {
      setClauses.push(`total_mcp_calls = $${paramIndex++}`);
      values.push(updates.total_mcp_calls);
    }
    if (updates.total_tokens_used !== undefined) {
      setClauses.push(`total_tokens_used = $${paramIndex++}`);
      values.push(updates.total_tokens_used);
    }
    if (updates.total_cost_cents !== undefined) {
      setClauses.push(`total_cost_cents = $${paramIndex++}`);
      values.push(updates.total_cost_cents);
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_ts = now()');
    values.push(sessionId);

    const query = `
      UPDATE app.orchestrator_session
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}::uuid
    `;

    await client.unsafe(query, values);
  }

  /**
   * Set/update a state variable
   */
  async setState(
    sessionId: string,
    key: string,
    value: any,
    metadata?: {
      source?: string;
      node_context?: string;
      validated?: boolean;
    }
  ): Promise<void> {
    const valueType = this.detectValueType(value);

    await client`
      INSERT INTO app.orchestrator_state (
        id,
        session_id,
        key,
        value,
        value_type,
        source,
        node_context,
        validated
      ) VALUES (
        ${uuidv4()}::uuid,
        ${sessionId}::uuid,
        ${key},
        ${JSON.stringify(value)}::jsonb,
        ${valueType},
        ${metadata?.source || null},
        ${metadata?.node_context || null},
        ${metadata?.validated || false}
      )
      ON CONFLICT (session_id, key)
      DO UPDATE SET
        value = EXCLUDED.value,
        value_type = EXCLUDED.value_type,
        source = EXCLUDED.source,
        node_context = EXCLUDED.node_context,
        validated = EXCLUDED.validated,
        updated_ts = now()
    `;
  }

  /**
   * Get a state variable
   */
  async getState(sessionId: string, key: string): Promise<any | null> {
    const result = await client`
      SELECT value FROM app.orchestrator_state
      WHERE session_id = ${sessionId}::uuid AND key = ${key}
    `;

    return result.length > 0 ? result[0].value : null;
  }

  /**
   * Get all state variables for a session
   */
  async getAllState(sessionId: string): Promise<Record<string, any>> {
    const result = await client`
      SELECT key, value FROM app.orchestrator_state
      WHERE session_id = ${sessionId}::uuid
    `;

    const state: Record<string, any> = {};
    for (const row of result) {
      state[row.key] = row.value;
    }

    return state;
  }

  /**
   * Log an agent action
   */
  async logAgentAction(args: {
    session_id: string;
    agent_role: AgentRole;
    agent_action: string;
    node_context?: string;
    input_data?: Record<string, any>;
    output_data?: Record<string, any>;
    model_used?: string;
    tokens_used?: number;
    cost_cents?: number;
    mcp_tool_name?: string;
    mcp_tool_args?: Record<string, any>;
    mcp_tool_result?: Record<string, any>;
    mcp_success?: boolean;
    success?: boolean;
    error_message?: string;
    natural_response?: string;
    duration_ms?: number;
  }): Promise<string> {
    const logId = uuidv4();

    await client`
      INSERT INTO app.orchestrator_agent_log (
        id,
        session_id,
        agent_role,
        agent_action,
        node_context,
        input_data,
        output_data,
        model_used,
        tokens_used,
        cost_cents,
        mcp_tool_name,
        mcp_tool_args,
        mcp_tool_result,
        mcp_success,
        success,
        error_message,
        natural_response,
        duration_ms
      ) VALUES (
        ${logId}::uuid,
        ${args.session_id}::uuid,
        ${args.agent_role},
        ${args.agent_action},
        ${args.node_context || null},
        ${args.input_data ? JSON.stringify(args.input_data) : null}::jsonb,
        ${args.output_data ? JSON.stringify(args.output_data) : null}::jsonb,
        ${args.model_used || null},
        ${args.tokens_used || null},
        ${args.cost_cents || null},
        ${args.mcp_tool_name || null},
        ${args.mcp_tool_args ? JSON.stringify(args.mcp_tool_args) : null}::jsonb,
        ${args.mcp_tool_result ? JSON.stringify(args.mcp_tool_result) : null}::jsonb,
        ${args.mcp_success || null},
        ${args.success !== undefined ? args.success : true},
        ${args.error_message || null},
        ${args.natural_response || null},
        ${args.duration_ms || null}
      )
    `;

    return logId;
  }

  /**
   * Get agent logs for a session
   */
  async getAgentLogs(
    sessionId: string,
    filters?: {
      agent_role?: AgentRole;
      node_context?: string;
      limit?: number;
    }
  ): Promise<AgentLogEntry[]> {
    let query = client`
      SELECT * FROM app.orchestrator_agent_log
      WHERE session_id = ${sessionId}::uuid
    `;

    if (filters?.agent_role) {
      query = client`
        SELECT * FROM app.orchestrator_agent_log
        WHERE session_id = ${sessionId}::uuid
        AND agent_role = ${filters.agent_role}
      `;
    }

    if (filters?.node_context) {
      query = client`
        SELECT * FROM app.orchestrator_agent_log
        WHERE session_id = ${sessionId}::uuid
        AND node_context = ${filters.node_context}
      `;
    }

    const result = await query;

    return result.slice(0, filters?.limit || 100).map(this.mapLogEntry);
  }

  /**
   * Save a conversation summary
   */
  async saveSummary(args: {
    session_id: string;
    summary_type: 'full' | 'incremental' | 'node_completion';
    summary_text: string;
    up_to_node?: string;
    message_count?: number;
    model_used?: string;
    tokens_used?: number;
  }): Promise<string> {
    const summaryId = uuidv4();

    await client`
      INSERT INTO app.orchestrator_summary (
        id,
        session_id,
        summary_type,
        summary_text,
        up_to_node,
        message_count,
        model_used,
        tokens_used
      ) VALUES (
        ${summaryId}::uuid,
        ${args.session_id}::uuid,
        ${args.summary_type},
        ${args.summary_text},
        ${args.up_to_node || null},
        ${args.message_count || null},
        ${args.model_used || null},
        ${args.tokens_used || null}
      )
    `;

    return summaryId;
  }

  /**
   * Get latest summary
   */
  async getLatestSummary(sessionId: string): Promise<ConversationSummary | null> {
    const result = await client`
      SELECT * FROM app.orchestrator_summary
      WHERE session_id = ${sessionId}::uuid
      ORDER BY created_ts DESC
      LIMIT 1
    `;

    return result.length > 0 ? this.mapSummary(result[0]) : null;
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string, status: 'completed' | 'failed'): Promise<void> {
    await client`
      UPDATE app.orchestrator_session
      SET
        status = ${status},
        completed_ts = now(),
        updated_ts = now()
      WHERE id = ${sessionId}::uuid
    `;
  }

  /**
   * Get circuit breaker state
   */
  async getCircuitBreakerState(
    sessionId: string,
    agentType: string
  ): Promise<any | null> {
    const result = await client`
      SELECT * FROM app.orchestrator_circuit_breaker
      WHERE session_id = ${sessionId}::uuid
      AND agent_type = ${agentType}
    `;

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Update circuit breaker state
   */
  async updateCircuitBreakerState(
    sessionId: string,
    agentType: string,
    state: {
      circuit_state: string;
      failure_count: number;
      last_failure_ts?: Date;
      opened_ts?: Date;
      last_success_ts?: Date;
      consecutive_successes: number;
      failure_threshold: number;
      timeout_ms: number;
    }
  ): Promise<void> {
    await client`
      INSERT INTO app.orchestrator_circuit_breaker (
        id,
        session_id,
        agent_type,
        circuit_state,
        failure_count,
        last_failure_ts,
        opened_ts,
        last_success_ts,
        consecutive_successes,
        failure_threshold,
        timeout_ms
      ) VALUES (
        ${uuidv4()}::uuid,
        ${sessionId}::uuid,
        ${agentType},
        ${state.circuit_state},
        ${state.failure_count},
        ${state.last_failure_ts || null},
        ${state.opened_ts || null},
        ${state.last_success_ts || null},
        ${state.consecutive_successes},
        ${state.failure_threshold},
        ${state.timeout_ms}
      )
      ON CONFLICT (session_id, agent_type)
      DO UPDATE SET
        circuit_state = EXCLUDED.circuit_state,
        failure_count = EXCLUDED.failure_count,
        last_failure_ts = EXCLUDED.last_failure_ts,
        opened_ts = EXCLUDED.opened_ts,
        last_success_ts = EXCLUDED.last_success_ts,
        consecutive_successes = EXCLUDED.consecutive_successes,
        failure_threshold = EXCLUDED.failure_threshold,
        timeout_ms = EXCLUDED.timeout_ms,
        updated_ts = now()
    `;
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private async generateSessionNumber(): Promise<string> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const result = await client`
      SELECT COUNT(*) as count
      FROM app.orchestrator_session
      WHERE session_number LIKE ${'ORCH-' + today + '%'}
    `;

    const count = parseInt(result[0].count) + 1;
    return `ORCH-${today}-${count.toString().padStart(4, '0')}`;
  }

  private detectValueType(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (value && typeof value === 'object') return 'object';
    return 'unknown';
  }

  private mapSession(row: any): OrchestratorSession {
    return {
      id: row.id,
      session_number: row.session_number,
      chat_session_id: row.chat_session_id,
      user_id: row.user_id,
      tenant_id: row.tenant_id,
      auth_metadata: row.auth_metadata || {},
      current_intent: row.current_intent,
      current_node: row.current_node,
      intent_graph_version: row.intent_graph_version,
      status: row.status,
      session_context: row.session_context || {},
      conversation_summary: row.conversation_summary,
      last_summary_ts: row.last_summary_ts,
      total_agent_calls: row.total_agent_calls || 0,
      total_mcp_calls: row.total_mcp_calls || 0,
      total_tokens_used: row.total_tokens_used || 0,
      total_cost_cents: row.total_cost_cents || 0,
      created_ts: row.created_ts,
      updated_ts: row.updated_ts,
      completed_ts: row.completed_ts
    };
  }

  private mapLogEntry(row: any): AgentLogEntry {
    return {
      id: row.id,
      session_id: row.session_id,
      agent_role: row.agent_role,
      agent_action: row.agent_action,
      node_context: row.node_context,
      input_data: row.input_data,
      output_data: row.output_data,
      model_used: row.model_used,
      tokens_used: row.tokens_used,
      cost_cents: row.cost_cents,
      mcp_tool_name: row.mcp_tool_name,
      mcp_tool_args: row.mcp_tool_args,
      mcp_tool_result: row.mcp_tool_result,
      mcp_success: row.mcp_success,
      success: row.success,
      error_message: row.error_message,
      natural_response: row.natural_response,
      duration_ms: row.duration_ms,
      created_ts: row.created_ts
    };
  }

  private mapSummary(row: any): ConversationSummary {
    return {
      id: row.id,
      session_id: row.session_id,
      summary_type: row.summary_type,
      summary_text: row.summary_text,
      up_to_node: row.up_to_node,
      message_count: row.message_count,
      model_used: row.model_used,
      tokens_used: row.tokens_used,
      created_ts: row.created_ts
    };
  }
}

// Export singleton instance
export const stateManager = new StateManager();
