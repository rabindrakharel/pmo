/**
 * Context Manager Service
 * Pure PostgreSQL-based context persistence (no LangGraph)
 * Manages context.json for each conversation session
 * @module orchestrator/langgraph/context-manager
 */

import { getDatabase } from '../../../../infrastructure/database.js';
import type { DAGConfiguration } from './dag-types.js';
import { loadDAGConfiguration } from './dag-loader.service.js';

/**
 * Conversation Context
 * The complete state of a conversation session
 */
export interface ConversationContext {
  session_id: string;

  // Conversation messages
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;

  // Core context fields (from dag.json global_context_schema)
  who_are_you?: string;
  customers_main_ask?: string; // mandatory
  customer_phone_number?: string; // mandatory
  customer_name?: string;
  customer_email?: string;
  customer_address?: string;
  customer_id?: string;
  matching_service_catalog_to_solve_customers_issue?: string;
  related_entities_for_customers_ask?: string[] | string;
  task_id?: string;
  appointment_details?: string;
  next_steps_plan?: string[];
  execution_results?: string;

  // Navigation state
  current_node: string;
  next_node_to_go_to?: string;
  node_traversal_path: string[]; // Array of nodes LLM has traversed

  // Flags (all 0/1)
  flags: Record<string, number>;

  // Conversation summary (mandatory after each step)
  summary_of_conversation_on_each_step_until_now: Array<{
    customer: string;
    agent: string;
  }>;

  // Metadata
  created_at: string;
  updated_at: string;
  conversation_ended: boolean;
  end_reason?: string;
}

/**
 * Context Manager
 * Handles all context persistence and retrieval
 */
export class ContextManager {
  private dagConfig: DAGConfiguration;

  constructor() {
    this.dagConfig = loadDAGConfiguration();
  }

  /**
   * Initialize new conversation context
   */
  async createContext(sessionId: string): Promise<ConversationContext> {
    console.log(`[ContextManager] 🆕 Creating new context for session: ${sessionId}`);

    const db = await getDatabase();
    const now = new Date().toISOString();

    // Initialize with default values from dag.json
    const defaultValues = this.dagConfig.system_config?.default_context_values || {};
    const entryNode = this.dagConfig.graph_config?.entry_node || 'I_greet_customer';

    // Initialize all flags to 0
    const initialFlags: Record<string, number> = {};
    const flagDefinitions = this.dagConfig.routing_config?.flag_definitions || {};
    for (const flagName of Object.keys(flagDefinitions)) {
      initialFlags[flagName] = 0;
    }

    const context: ConversationContext = {
      session_id: sessionId,
      messages: [],
      who_are_you: defaultValues.who_are_you,
      current_node: entryNode,
      node_traversal_path: [],
      flags: initialFlags,
      summary_of_conversation_on_each_step_until_now: [],
      created_at: now,
      updated_at: now,
      conversation_ended: false,
    };

    // Store in PostgreSQL
    await db.query(
      `INSERT INTO app.chat_context
       (session_id, context_data, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id)
       DO UPDATE SET context_data = $2, updated_at = $4`,
      [sessionId, JSON.stringify(context), now, now]
    );

    console.log(`[ContextManager] ✅ Context created for session: ${sessionId}`);
    return context;
  }

  /**
   * Load existing conversation context
   */
  async loadContext(sessionId: string): Promise<ConversationContext | null> {
    console.log(`[ContextManager] 📥 Loading context for session: ${sessionId}`);

    const db = await getDatabase();
    const result = await db.query(
      `SELECT context_data FROM app.chat_context WHERE session_id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      console.log(`[ContextManager] ⚠️  No context found for session: ${sessionId}`);
      return null;
    }

    const context = result.rows[0].context_data as ConversationContext;
    console.log(`[ContextManager] ✅ Context loaded for session: ${sessionId}`);
    console.log(`[ContextManager] 📍 Current node: ${context.current_node}`);
    console.log(`[ContextManager] 🎯 Traversal path: ${context.node_traversal_path.join(' → ')}`);

    return context;
  }

  /**
   * Get or create context
   */
  async getOrCreateContext(sessionId: string): Promise<ConversationContext> {
    let context = await this.loadContext(sessionId);

    if (!context) {
      context = await this.createContext(sessionId);
    }

    return context;
  }

  /**
   * Save context to PostgreSQL
   */
  async saveContext(context: ConversationContext): Promise<void> {
    console.log(`[ContextManager] 💾 Saving context for session: ${context.session_id}`);

    const db = await getDatabase();
    const now = new Date().toISOString();
    context.updated_at = now;

    await db.query(
      `UPDATE app.chat_context
       SET context_data = $1, updated_at = $2
       WHERE session_id = $3`,
      [JSON.stringify(context), now, context.session_id]
    );

    console.log(`[ContextManager] ✅ Context saved for session: ${context.session_id}`);
  }

  /**
   * Update specific context fields (non-destructive)
   */
  async updateContextFields(
    sessionId: string,
    updates: Partial<ConversationContext>
  ): Promise<ConversationContext> {
    console.log(`[ContextManager] 🔄 Updating context fields for session: ${sessionId}`);
    console.log(`[ContextManager] 📝 Fields to update:`, Object.keys(updates));

    const context = await this.getOrCreateContext(sessionId);

    // Non-destructive merge (preserve existing values unless explicitly updating)
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        (context as any)[key] = value;
      }
    }

    await this.saveContext(context);

    console.log(`[ContextManager] ✅ Context fields updated`);
    return context;
  }

  /**
   * Add user message to context
   */
  async addUserMessage(sessionId: string, content: string): Promise<ConversationContext> {
    console.log(`[ContextManager] 💬 Adding user message to session: ${sessionId}`);

    const context = await this.getOrCreateContext(sessionId);

    context.messages.push({
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });

    await this.saveContext(context);

    return context;
  }

  /**
   * Add agent message to context
   */
  async addAgentMessage(sessionId: string, content: string): Promise<ConversationContext> {
    console.log(`[ContextManager] 🤖 Adding agent message to session: ${sessionId}`);

    const context = await this.getOrCreateContext(sessionId);

    context.messages.push({
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
    });

    await this.saveContext(context);

    return context;
  }

  /**
   * Track node traversal
   */
  async addNodeToTraversal(sessionId: string, nodeName: string): Promise<ConversationContext> {
    console.log(`[ContextManager] 🚶 Adding node to traversal: ${nodeName}`);

    const context = await this.getOrCreateContext(sessionId);

    // Add to traversal path if not already the last entry
    if (context.node_traversal_path[context.node_traversal_path.length - 1] !== nodeName) {
      context.node_traversal_path.push(nodeName);
    }

    // Update current node
    context.current_node = nodeName;

    await this.saveContext(context);

    console.log(`[ContextManager] 📍 Traversal path: ${context.node_traversal_path.join(' → ')}`);
    return context;
  }

  /**
   * Update conversation summary
   */
  async updateSummary(
    sessionId: string,
    customerMessage: string,
    agentMessage: string
  ): Promise<ConversationContext> {
    console.log(`[ContextManager] 📋 Updating conversation summary`);

    const context = await this.getOrCreateContext(sessionId);

    context.summary_of_conversation_on_each_step_until_now.push({
      customer: customerMessage,
      agent: agentMessage,
    });

    await this.saveContext(context);

    return context;
  }

  /**
   * Update flags
   */
  async updateFlags(
    sessionId: string,
    flagUpdates: Record<string, number>
  ): Promise<ConversationContext> {
    console.log(`[ContextManager] 🚩 Updating flags:`, flagUpdates);

    const context = await this.getOrCreateContext(sessionId);

    // Update flags (0 or 1)
    for (const [flagName, flagValue] of Object.entries(flagUpdates)) {
      context.flags[flagName] = flagValue === 1 ? 1 : 0;
    }

    await this.saveContext(context);

    console.log(`[ContextManager] ✅ Flags updated`);
    return context;
  }

  /**
   * Reset flags (for issue change or data update)
   */
  async resetFlags(
    sessionId: string,
    flagsToReset: string[],
    preserveCustomerData: boolean = true
  ): Promise<ConversationContext> {
    console.log(`[ContextManager] 🔄 Resetting flags:`, flagsToReset);

    const context = await this.getOrCreateContext(sessionId);

    // Reset specified flags to 0
    for (const flagName of flagsToReset) {
      if (context.flags[flagName] !== undefined) {
        context.flags[flagName] = 0;
      }
    }

    // Optionally clear context fields (but preserve customer data)
    if (!preserveCustomerData) {
      context.customers_main_ask = undefined;
      context.matching_service_catalog_to_solve_customers_issue = undefined;
      context.task_id = undefined;
      context.appointment_details = undefined;
      context.next_steps_plan = undefined;
      context.execution_results = undefined;
    }

    await this.saveContext(context);

    console.log(`[ContextManager] ✅ Flags reset`);
    return context;
  }

  /**
   * End conversation
   */
  async endConversation(
    sessionId: string,
    reason: string
  ): Promise<ConversationContext> {
    console.log(`[ContextManager] 🏁 Ending conversation: ${reason}`);

    const context = await this.getOrCreateContext(sessionId);

    context.conversation_ended = true;
    context.end_reason = reason;

    await this.saveContext(context);

    console.log(`[ContextManager] ✅ Conversation ended`);
    return context;
  }

  /**
   * Get conversation history (last N messages)
   */
  getRecentMessages(context: ConversationContext, count: number = 5): Array<{ role: string; content: string }> {
    return context.messages.slice(-count);
  }

  /**
   * Check if mandatory fields are collected
   */
  checkMandatoryFields(context: ConversationContext): boolean {
    const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || [
      'customers_main_ask',
      'customer_phone_number',
    ];

    for (const field of mandatoryFields) {
      const value = (context as any)[field];
      if (!value || value === '') {
        console.log(`[ContextManager] ⚠️  Mandatory field missing: ${field}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Get available nodes from dag.json
   */
  getAvailableNodes(): string[] {
    return this.dagConfig.nodes?.map(node => node.node_name) || [];
  }

  /**
   * Get node definition from dag.json
   */
  getNodeDefinition(nodeName: string) {
    return this.dagConfig.nodes?.find(node => node.node_name === nodeName);
  }
}

/**
 * Singleton instance
 */
let instance: ContextManager | null = null;

export function getContextManager(): ContextManager {
  if (!instance) {
    instance = new ContextManager();
  }
  return instance;
}
