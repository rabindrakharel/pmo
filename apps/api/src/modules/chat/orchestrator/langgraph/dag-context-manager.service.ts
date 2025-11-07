/**
 * DAG Context Manager Service
 * Manages context state, flags, resets, and mandatory field validation
 * @module orchestrator/langgraph/dag-context-manager
 */

import type {
  DAGContext,
  DAGConfiguration,
  ConversationSummary,
} from './dag-types.js';

/**
 * DAG Context Manager
 * Handles all context operations based on DAG configuration
 */
export class DAGContextManager {
  private dagConfig: DAGConfiguration;

  constructor(dagConfig: DAGConfiguration) {
    this.dagConfig = dagConfig;
  }

  /**
   * Initialize empty context with default values
   */
  initializeContext(): DAGContext {
    const flags: Record<string, number> = {};

    // Initialize all flags to 0
    for (const flagName of Object.keys(this.dagConfig.routing_config.flag_definitions)) {
      flags[flagName] = 0;
    }

    return {
      who_are_you: 'You are a polite customer service agent who is assisting a customer',
      customer_name: '',
      customer_phone_number: '',
      customer_id: '',
      customers_main_ask: '',
      matching_service_catalog_to_solve_customers_issue: '',
      related_entities_for_customers_ask: '',
      task_id: '',
      appointment_details: '',
      next_steps_plans_help_customer: '',
      execution_results: '',
      summary_of_conversation_on_each_step_until_now: [],
      flags,
    };
  }

  /**
   * Merge context updates (non-destructive)
   */
  mergeContext(current: DAGContext, updates: Partial<DAGContext>): DAGContext {
    const merged = { ...current };

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'flags') {
        // Merge flags specifically
        merged.flags = { ...(current.flags || {}), ...(value as Record<string, number>) };
      } else if (key === 'summary_of_conversation_on_each_step_until_now') {
        // Append to summary array
        merged.summary_of_conversation_on_each_step_until_now = [
          ...(current.summary_of_conversation_on_each_step_until_now || []),
          ...(value as ConversationSummary[]),
        ];
      } else if (value !== undefined && value !== null && value !== '') {
        // Non-destructive: only update if new value is meaningful
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Set a specific flag
   */
  setFlag(context: DAGContext, flagName: string, value: number): DAGContext {
    return {
      ...context,
      flags: {
        ...(context.flags || {}),
        [flagName]: value,
      },
    };
  }

  /**
   * Get flag value
   */
  getFlag(context: DAGContext, flagName: string): number {
    return context.flags?.[flagName] || 0;
  }

  /**
   * Check if flag is set (equals 1)
   */
  isFlagSet(context: DAGContext, flagName: string): boolean {
    return this.getFlag(context, flagName) === 1;
  }

  /**
   * Reset flags based on reset_on triggers
   */
  resetFlagsForTrigger(context: DAGContext, trigger: string): DAGContext {
    const newFlags = { ...(context.flags || {}) };

    for (const [flagName, flagDef] of Object.entries(
      this.dagConfig.routing_config.flag_definitions
    )) {
      if (flagDef.reset_on.includes(trigger)) {
        newFlags[flagName] = 0;
        console.log(`[DAG Context] 🔄 Reset flag: ${flagName} (trigger: ${trigger})`);
      }
    }

    return {
      ...context,
      flags: newFlags,
    };
  }

  /**
   * Detect issue change from message
   */
  detectIssueChange(message: string): boolean {
    const keywords = this.dagConfig.routing_config.variables.issue_change_keywords;
    const lowerMessage = message.toLowerCase();

    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        console.log(`[DAG Context] 🔄 Issue change detected: keyword="${keyword}"`);
        return true;
      }
    }

    return false;
  }

  /**
   * Detect data update request from message
   */
  detectDataUpdate(message: string): string | null {
    const keywords = this.dagConfig.routing_config.variables.data_update_keywords;
    const lowerMessage = message.toLowerCase();

    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        // Extract field name from keyword
        if (keyword.includes('phone')) {
          console.log(`[DAG Context] 🔄 Data update detected: phone`);
          return 'data_phone_update';
        } else if (keyword.includes('name')) {
          console.log(`[DAG Context] 🔄 Data update detected: name`);
          return 'data_name_update';
        } else if (keyword.includes('email')) {
          console.log(`[DAG Context] 🔄 Data update detected: email`);
          return 'data_email_update';
        } else if (keyword.includes('address')) {
          console.log(`[DAG Context] 🔄 Data update detected: address`);
          return 'data_address_update';
        }
      }
    }

    return null;
  }

  /**
   * Detect consent (yes/no) from message
   */
  detectConsent(message: string): 'yes' | 'no' | null {
    const yesKeywords = this.dagConfig.routing_config.variables.consent_yes_keywords;
    const noKeywords = this.dagConfig.routing_config.variables.consent_no_keywords;
    const lowerMessage = message.toLowerCase();

    for (const keyword of yesKeywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return 'yes';
      }
    }

    for (const keyword of noKeywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return 'no';
      }
    }

    return null;
  }

  /**
   * Detect conversation continuation intent
   */
  detectContinueConversation(message: string): boolean {
    const keywords = this.dagConfig.routing_config.variables.continue_conversation_keywords;
    const lowerMessage = message.toLowerCase();

    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect conversation end intent
   */
  detectEndConversation(message: string): boolean {
    const keywords = this.dagConfig.routing_config.variables.end_conversation_keywords;
    const lowerMessage = message.toLowerCase();

    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if mandatory fields are populated
   */
  checkMandatoryFields(context: DAGContext): {
    complete: boolean;
    missing: string[];
  } {
    const mandatoryFields = this.dagConfig.graph_config.mandatory_fields;
    const missing: string[] = [];

    for (const field of mandatoryFields) {
      const value = context[field];
      if (!value || value === '') {
        missing.push(field);
      }
    }

    return {
      complete: missing.length === 0,
      missing,
    };
  }

  /**
   * Check if all data collection flags are set
   */
  isDataCollectionComplete(context: DAGContext): boolean {
    const dataFlags = ['data_name_flag', 'data_phone_flag'];

    for (const flag of dataFlags) {
      if (!this.isFlagSet(context, flag)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Append conversation summary
   */
  appendConversationSummary(
    context: DAGContext,
    customerMsg: string,
    agentMsg: string
  ): DAGContext {
    const summary: ConversationSummary = {
      customer: customerMsg,
      agent: agentMsg,
    };

    return {
      ...context,
      summary_of_conversation_on_each_step_until_now: [
        ...(context.summary_of_conversation_on_each_step_until_now || []),
        summary,
      ],
    };
  }

  /**
   * Build context JSON string for LLM prompts
   */
  buildContextString(context: DAGContext): string {
    // Create a clean copy without internal flags for display
    const displayContext = {
      who_are_you: context.who_are_you,
      customer_name: context.customer_name,
      customer_phone_number: context.customer_phone_number,
      customer_id: context.customer_id,
      customers_main_ask: context.customers_main_ask,
      matching_service_catalog: context.matching_service_catalog_to_solve_customers_issue,
      related_entities: context.related_entities_for_customers_ask,
      task_id: context.task_id,
      appointment_details: context.appointment_details,
      plan: context.next_steps_plans_help_customer,
      execution_results: context.execution_results,
      summary_count: context.summary_of_conversation_on_each_step_until_now?.length || 0,
    };

    return JSON.stringify(displayContext, null, 2);
  }

  /**
   * Get full context for LLM (with history)
   */
  getFullContextForLLM(context: DAGContext): string {
    return JSON.stringify(context, null, 2);
  }
}
