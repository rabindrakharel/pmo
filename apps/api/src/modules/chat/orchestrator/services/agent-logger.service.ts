/**
 * Structured Agent Logger
 * Provides concise, timestamp-based logging for agent operations
 */

export class AgentLogger {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  private timestamp(): string {
    return new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
  }

  private sessionShort(): string {
    return this.sessionId.substring(0, 8);
  }

  /**
   * Log iteration start
   */
  iteration(iteration: number, node: string, userMessage?: string): void {
    console.log(`\n[${'='.repeat(70)}]`);
    console.log(`[${this.timestamp()}] 🔄 ITER ${iteration} | Node: ${node} | Session: ${this.sessionShort()}`);
    if (userMessage) {
      console.log(`[${this.timestamp()}] 👤 User: ${userMessage.substring(0, 80)}${userMessage.length > 80 ? '...' : ''}`);
    }
  }

  /**
   * Log agent execution
   */
  agent(agentType: string, node: string, result?: string): void {
    const agentIcon = {
      worker_reply: '🗣️',
      worker_mcp: '🔧',
      navigator: '🧭',
      data_extraction: '🔍'
    }[agentType] || '🤖';

    const msg = result ? `: ${result.substring(0, 100)}${result.length > 100 ? '...' : ''}` : '';
    console.log(`[${this.timestamp()}] ${agentIcon} ${agentType.toUpperCase()} @ ${node}${msg}`);
  }

  /**
   * Log navigation decision
   */
  navigate(from: string, to: string, reason?: string): void {
    console.log(`[${this.timestamp()}] ➡️  Navigate: ${from} → ${to}${reason ? ` (${reason})` : ''}`);
  }

  /**
   * Log data extraction
   */
  extraction(fields: string[]): void {
    if (fields.length > 0) {
      console.log(`[${this.timestamp()}] 📝 Extracted: ${fields.join(', ')}`);
    }
  }

  /**
   * Log context update
   */
  context(field: string, value: string): void {
    const preview = value.length > 50 ? value.substring(0, 47) + '...' : value;
    console.log(`[${this.timestamp()}] 💾 ${field}: ${preview}`);
  }

  /**
   * Log conversation end
   */
  end(reason: string): void {
    console.log(`[${this.timestamp()}] 🏁 Session End: ${reason}`);
    console.log(`[${'='.repeat(70)}]\n`);
  }

  /**
   * Log error
   */
  error(message: string, error?: any): void {
    console.error(`[${this.timestamp()}] ❌ Error: ${message}`, error?.message || '');
  }

  /**
   * Log warning
   */
  warn(message: string): void {
    console.warn(`[${this.timestamp()}] ⚠️  ${message}`);
  }

  /**
   * Log session snapshot (key context state)
   */
  snapshot(state: {
    node: string;
    customer_name?: string;
    customer_phone?: string;
    main_ask?: string;
    task_id?: string;
    traversed?: number;
  }): void {
    console.log(`[${this.timestamp()}] 📊 Snapshot @ ${state.node}:`);
    if (state.customer_name) console.log(`  ├─ Customer: ${state.customer_name}`);
    if (state.customer_phone) console.log(`  ├─ Phone: ${state.customer_phone}`);
    if (state.main_ask) console.log(`  ├─ Ask: ${state.main_ask.substring(0, 60)}${state.main_ask.length > 60 ? '...' : ''}`);
    if (state.task_id) console.log(`  ├─ Task: ${state.task_id}`);
    if (state.traversed) console.log(`  └─ Path: ${state.traversed} nodes`);
  }
}

/**
 * Create session-scoped logger
 */
export function createAgentLogger(sessionId: string): AgentLogger {
  return new AgentLogger(sessionId);
}
