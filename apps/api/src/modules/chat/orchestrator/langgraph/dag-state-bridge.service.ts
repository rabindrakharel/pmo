/**
 * DAG State Bridge Service
 * Bridges between LangGraph state (progress_flags) and DAG state (dag_context.flags)
 * Ensures coherence between the two state representations
 * @module orchestrator/langgraph/dag-state-bridge
 */

import type { DAGContext } from './dag-types.js';

/**
 * Flag mapping between progress_flags and dag_context.flags
 */
const FLAG_MAPPING: Record<string, string> = {
  // progress_flags name → dag_context.flags name
  greeted: 'greet_flag',
  asked_need: 'ask_need_flag',
  issue_identified: 'identify_issue_flag',
  empathized: 'empathize_flag',
  rapport_built: 'rapport_flag',
  phone_collected: 'data_phone_flag',
  name_collected: 'data_name_flag',
  email_collected: 'data_email_flag',
  address_collected: 'data_address_flag',
  customer_checked: 'check_customer_flag',
  plan_created: 'plan_flag',
  plan_communicated: 'communicate_plan_flag',
  plan_executed: 'execute_flag',
  execution_communicated: 'tell_execution_flag',
  goodbye: 'goodbye_flag',
};

/**
 * Reverse mapping for dag_context.flags → progress_flags
 */
const REVERSE_FLAG_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(FLAG_MAPPING).map(([k, v]) => [v, k])
);

/**
 * DAG State Bridge
 * Synchronizes state between progress_flags and dag_context
 */
export class DAGStateBridge {
  /**
   * Convert progress_flags to dag_context.flags
   */
  progressFlagsToDAGFlags(progressFlags: Record<string, boolean>): Record<string, number> {
    const dagFlags: Record<string, number> = {};

    for (const [progressKey, dagKey] of Object.entries(FLAG_MAPPING)) {
      dagFlags[dagKey] = progressFlags[progressKey] ? 1 : 0;
    }

    return dagFlags;
  }

  /**
   * Convert dag_context.flags to progress_flags
   */
  dagFlagsToProgressFlags(dagFlags: Record<string, number>): Record<string, boolean> {
    const progressFlags: Record<string, boolean> = {};

    for (const [dagKey, progressKey] of Object.entries(REVERSE_FLAG_MAPPING)) {
      progressFlags[progressKey] = dagFlags[dagKey] === 1;
    }

    return progressFlags;
  }

  /**
   * Sync progress_flags from dag_context
   * Updates progress_flags based on dag_context.flags
   */
  syncProgressFlagsFromDAG(
    progressFlags: Record<string, boolean>,
    dagContext: DAGContext
  ): Record<string, boolean> {
    if (!dagContext.flags) {
      return progressFlags;
    }

    const updated = { ...progressFlags };

    for (const [dagKey, value] of Object.entries(dagContext.flags)) {
      const progressKey = REVERSE_FLAG_MAPPING[dagKey];
      if (progressKey) {
        updated[progressKey] = value === 1;
      }
    }

    return updated;
  }

  /**
   * Sync dag_context from progress_flags
   * Updates dag_context.flags based on progress_flags
   */
  syncDAGFromProgressFlags(
    dagContext: DAGContext,
    progressFlags: Record<string, boolean>
  ): DAGContext {
    const updated = { ...dagContext };

    if (!updated.flags) {
      updated.flags = {};
    }

    for (const [progressKey, value] of Object.entries(progressFlags)) {
      const dagKey = FLAG_MAPPING[progressKey];
      if (dagKey) {
        updated.flags[dagKey] = value ? 1 : 0;
      }
    }

    return updated;
  }

  /**
   * Create initial DAG context from existing state
   */
  createDAGContextFromState(state: {
    context?: Record<string, any>;
    progress_flags?: Record<string, boolean>;
    customer_profile?: Record<string, any>;
  }): DAGContext {
    const dagContext: DAGContext = {
      who_are_you: 'You are a polite customer service agent who is assisting a customer',
      customer_name: state.context?.customer_name || '',
      customer_phone_number: state.context?.customer_phone_number || '',
      customer_email: state.context?.customer_email || '',
      customer_address: state.context?.customer_address || '',
      customer_id: state.customer_profile?.customer_id || '',
      customers_main_ask: state.context?.customers_main_ask || '',
      matching_service_catalog_to_solve_customers_issue:
        state.context?.matching_service_catalog_to_solve_customers_issue || '',
      related_entities_for_customers_ask: state.context?.related_entities_for_customers_ask || [],
      task_id: state.context?.task_id || '',
      appointment_details: state.context?.appointment_details || '',
      next_steps_plans_help_customer: state.context?.next_steps_plans_help_customer || '',
      execution_results: state.context?.execution_results || '',
      summary_of_conversation_on_each_step_until_now:
        state.context?.summary_of_conversation_on_each_step_until_now || [],
      flags: this.progressFlagsToDAGFlags(state.progress_flags || {}),
    };

    return dagContext;
  }

  /**
   * Update existing state from DAG context
   */
  updateStateFromDAGContext(
    state: {
      context?: Record<string, any>;
      progress_flags?: Record<string, boolean>;
      customer_profile?: Record<string, any>;
    },
    dagContext: DAGContext
  ): {
    context: Record<string, any>;
    progress_flags: Record<string, boolean>;
    customer_profile: Record<string, any>;
  } {
    return {
      context: {
        ...(state.context || {}),
        customer_name: dagContext.customer_name,
        customer_phone_number: dagContext.customer_phone_number,
        customer_email: dagContext.customer_email,
        customer_address: dagContext.customer_address,
        customers_main_ask: dagContext.customers_main_ask,
        matching_service_catalog_to_solve_customers_issue:
          dagContext.matching_service_catalog_to_solve_customers_issue,
        related_entities_for_customers_ask: dagContext.related_entities_for_customers_ask,
        task_id: dagContext.task_id,
        appointment_details: dagContext.appointment_details,
        next_steps_plans_help_customer: dagContext.next_steps_plans_help_customer,
        execution_results: dagContext.execution_results,
        summary_of_conversation_on_each_step_until_now:
          dagContext.summary_of_conversation_on_each_step_until_now,
      },
      progress_flags: this.dagFlagsToProgressFlags(dagContext.flags || {}),
      customer_profile: {
        ...(state.customer_profile || {}),
        customer_id: dagContext.customer_id,
      },
    };
  }

  /**
   * Check if a flag is set in progress_flags
   */
  isFlagSet(progressFlags: Record<string, boolean>, flagName: string): boolean {
    // Try progress_flags name first
    if (progressFlags[flagName] !== undefined) {
      return progressFlags[flagName];
    }

    // Try DAG flag name
    const progressKey = REVERSE_FLAG_MAPPING[flagName];
    if (progressKey && progressFlags[progressKey] !== undefined) {
      return progressFlags[progressKey];
    }

    return false;
  }

  /**
   * Set a flag in progress_flags (returns updated flags)
   */
  setFlag(
    progressFlags: Record<string, boolean>,
    flagName: string,
    value: boolean
  ): Record<string, boolean> {
    const updated = { ...progressFlags };

    // Try progress_flags name first
    if (FLAG_MAPPING[flagName]) {
      updated[flagName] = value;
      return updated;
    }

    // Try DAG flag name
    const progressKey = REVERSE_FLAG_MAPPING[flagName];
    if (progressKey) {
      updated[progressKey] = value;
      return updated;
    }

    // Unknown flag, just set it
    updated[flagName] = value;
    return updated;
  }
}

/**
 * Singleton instance
 */
let bridgeInstance: DAGStateBridge | null = null;

export function getDAGStateBridge(): DAGStateBridge {
  if (!bridgeInstance) {
    bridgeInstance = new DAGStateBridge();
  }
  return bridgeInstance;
}
