/**
 * Context Migration: v2 (Flat) → v3 (Hierarchical)
 * Migrates old flat context structure to new hierarchical goal-oriented structure
 *
 * @module orchestrator/migrations/context-migration
 * @version 3.0.0
 */

import type { ConversationContextV3 } from '../config/agent-config.schema.js';

/**
 * Old v2 context structure (flat)
 */
interface ContextV2 {
  agent_session_id?: string;
  who_are_you?: string;

  // Customer data
  customer_name?: string;
  customer_phone_number?: string;
  customer_email?: string;
  customer_id?: string;

  // Business data
  customers_main_ask?: string;
  matching_service_catalog_to_solve_customers_issue?: string;
  related_entities_for_customers_ask?: string;

  // Operational data
  task_id?: string;
  task_name?: string;
  appointment_details?: string;
  project_id?: string;
  assigned_employee_id?: string;
  assigned_employee_name?: string;

  // Flow control
  next_course_of_action?: string;
  next_node_to_go_to?: string;
  node_traversal_path?: string[];

  // Conversation history
  summary_of_conversation_on_each_step_until_now?: Array<{
    customer: string;
    agent: string;
  }>;

  // Flags
  flags?: Record<string, 0 | 1>;

  // Call lifecycle
  call_ended?: boolean;
  hangup_status?: string;

  // Any other fields
  [key: string]: any;
}

/**
 * Migrate context from v2 to v3
 */
export function migrateContextV2toV3(
  oldContext: ContextV2,
  sessionId?: string,
  chatSessionId?: string,
  userId?: string
): ConversationContextV3 {
  console.log('[ContextMigration] Migrating context from v2 to v3...');

  const now = new Date().toISOString();

  // Parse appointment details if it's a string
  let appointmentData: any = {};
  if (oldContext.appointment_details) {
    try {
      // Try to parse if it's JSON
      if (oldContext.appointment_details.startsWith('{')) {
        appointmentData = JSON.parse(oldContext.appointment_details);
      } else {
        // It's a plain string description
        appointmentData = {
          scheduled_time: oldContext.appointment_details
        };
      }
    } catch {
      appointmentData = {
        scheduled_time: oldContext.appointment_details
      };
    }
  }

  // Convert conversation history
  const conversationHistory = (oldContext.summary_of_conversation_on_each_step_until_now || []).map((ex, i) => ({
    index: i,
    customer: ex.customer || '',
    agent: ex.agent || '',
    timestamp: now,
    agent_reasoning: undefined
  }));

  // Determine current goal based on node traversal path or next node
  const currentGoal = mapNodeToGoal(
    oldContext.next_node_to_go_to ||
    oldContext.node_traversal_path?.[oldContext.node_traversal_path.length - 1] ||
    'GREET_CUSTOMER'
  );

  // Determine completed goals based on traversal path
  const completedGoals = determineCompletedGoals(oldContext.node_traversal_path || []);

  const newContext: ConversationContextV3 = {
    session: {
      id: sessionId || oldContext.agent_session_id || '',
      chat_session_id: chatSessionId || '',
      user_id: userId || '',
      started_at: now,
      last_updated: now
    },

    customer: {
      id: oldContext.customer_id,
      name: oldContext.customer_name,
      phone: oldContext.customer_phone_number,
      email: oldContext.customer_email
    },

    service: {
      primary_request: oldContext.customers_main_ask || '',
      service_category: oldContext.matching_service_catalog_to_solve_customers_issue,
      urgency: 'medium' // Default urgency
    },

    operations: {
      task_id: oldContext.task_id,
      task_name: oldContext.task_name,
      project_id: oldContext.project_id,
      appointment: {
        id: appointmentData.id || appointmentData.appointment_id,
        scheduled_time: appointmentData.scheduled_time || oldContext.assigned_employee_name,
        employee_id: oldContext.assigned_employee_id,
        employee_name: oldContext.assigned_employee_name,
        status: appointmentData.status || (oldContext.task_id ? 'pending' : undefined)
      },
      solution_plan: oldContext.next_course_of_action,
      execution_results: oldContext.related_entities_for_customers_ask
    },

    conversation: {
      current_goal: currentGoal,
      completed_goals: completedGoals,
      task_graph: undefined,
      history: conversationHistory,
      summary: undefined,
      sentiment: undefined
    },

    state: {
      mandatory_fields_collected: !!(oldContext.customers_main_ask && oldContext.customer_phone_number),
      customer_consent_given: false, // Unknown in v2
      ready_for_execution: !!oldContext.task_id,
      resolution_confirmed: !!oldContext.call_ended,
      call_ended: !!oldContext.call_ended
    },

    metadata: {
      total_turns: conversationHistory.length,
      total_goals_completed: completedGoals.length,
      llm_tokens_used: 0, // Not tracked in v2
      mcp_tools_called: [], // Not tracked in v2
      estimated_completion_percentage: calculateCompletionPercentage(completedGoals, currentGoal)
    }
  };

  console.log(`[ContextMigration] Migration complete. Current goal: ${currentGoal}, Completed: ${completedGoals.join(', ')}`);

  return newContext;
}

/**
 * Map old node names to new goals
 */
function mapNodeToGoal(nodeName: string): string {
  const nodeToGoalMap: Record<string, string> = {
    // UNDERSTAND_REQUEST goal
    'GREET_CUSTOMER': 'UNDERSTAND_REQUEST',
    'ASK_CUSTOMER_ABOUT_THEIR_NEED': 'UNDERSTAND_REQUEST',
    'Extract_Customer_Issue': 'UNDERSTAND_REQUEST',
    'Identify_Issue': 'UNDERSTAND_REQUEST',
    'Empathize': 'UNDERSTAND_REQUEST',
    'Console_Build_Rapport': 'UNDERSTAND_REQUEST',

    // GATHER_REQUIREMENTS goal
    'Try_To_Gather_Customers_Data': 'GATHER_REQUIREMENTS',
    'Check_IF_existing_customer': 'GATHER_REQUIREMENTS',
    'use_mcp_to_get_info': 'GATHER_REQUIREMENTS',
    'Get_Service_Catalog_From_MCP': 'GATHER_REQUIREMENTS',

    // DESIGN_SOLUTION goal
    'Plan': 'DESIGN_SOLUTION',
    'Communicate_To_Customer_Before_Action': 'DESIGN_SOLUTION',

    // EXECUTE_SOLUTION goal
    'Execute_Plan_Using_MCP': 'EXECUTE_SOLUTION',
    'Book_Appointment_Via_MCP': 'EXECUTE_SOLUTION',
    'Create_Task_Via_MCP': 'EXECUTE_SOLUTION',
    'Tell_Customers_Execution': 'EXECUTE_SOLUTION',

    // CONFIRM_RESOLUTION goal
    'Goodbye_And_Hangup': 'CONFIRM_RESOLUTION',
    'Execute_Call_Hangup': 'CONFIRM_RESOLUTION'
  };

  return nodeToGoalMap[nodeName] || 'UNDERSTAND_REQUEST';
}

/**
 * Determine which goals have been completed based on node traversal
 */
function determineCompletedGoals(nodeTraversalPath: string[]): string[] {
  const completedGoals: string[] = [];
  const goalCheckpoints: Record<string, string> = {
    'UNDERSTAND_REQUEST': 'Identify_Issue',
    'GATHER_REQUIREMENTS': 'Check_IF_existing_customer',
    'DESIGN_SOLUTION': 'Communicate_To_Customer_Before_Action',
    'EXECUTE_SOLUTION': 'Tell_Customers_Execution',
    'CONFIRM_RESOLUTION': 'Execute_Call_Hangup'
  };

  for (const [goal, checkpointNode] of Object.entries(goalCheckpoints)) {
    if (nodeTraversalPath.includes(checkpointNode)) {
      completedGoals.push(goal);
    }
  }

  return completedGoals;
}

/**
 * Calculate estimated completion percentage
 */
function calculateCompletionPercentage(completedGoals: string[], currentGoal: string): number {
  const allGoals = ['UNDERSTAND_REQUEST', 'GATHER_REQUIREMENTS', 'DESIGN_SOLUTION', 'EXECUTE_SOLUTION', 'CONFIRM_RESOLUTION'];
  const currentIndex = allGoals.indexOf(currentGoal);
  const completedCount = completedGoals.length;

  if (currentIndex === -1) {
    return (completedCount / allGoals.length) * 100;
  }

  // If we're in a goal, count it as 50% complete
  const totalProgress = completedCount + 0.5;
  return Math.min(100, Math.round((totalProgress / allGoals.length) * 100));
}

/**
 * Migrate multiple contexts (batch migration)
 */
export async function batchMigrateContexts(
  oldContexts: Array<{ context: ContextV2; sessionId: string; chatSessionId?: string; userId?: string }>
): Promise<Array<{ sessionId: string; newContext: ConversationContextV3; success: boolean; error?: string }>> {
  console.log(`[ContextMigration] Starting batch migration of ${oldContexts.length} contexts...`);

  const results = [];

  for (const { context, sessionId, chatSessionId, userId } of oldContexts) {
    try {
      const newContext = migrateContextV2toV3(context, sessionId, chatSessionId, userId);
      results.push({
        sessionId,
        newContext,
        success: true
      });
    } catch (error: any) {
      console.error(`[ContextMigration] Failed to migrate session ${sessionId}: ${error.message}`);
      results.push({
        sessionId,
        newContext: null as any,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[ContextMigration] Batch migration complete: ${successCount}/${oldContexts.length} successful`);

  return results;
}

/**
 * Validate migrated context
 */
export function validateMigratedContext(context: ConversationContextV3): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!context.session?.id) {
    errors.push('Missing session.id');
  }

  if (!context.conversation?.current_goal) {
    errors.push('Missing conversation.current_goal');
  }

  // Check data integrity
  if (context.state.mandatory_fields_collected) {
    if (!context.service?.primary_request) {
      errors.push('State says mandatory fields collected, but service.primary_request is empty');
    }
    if (!context.customer?.phone) {
      errors.push('State says mandatory fields collected, but customer.phone is empty');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
