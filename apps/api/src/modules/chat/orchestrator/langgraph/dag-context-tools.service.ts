/**
 * DAG Context Tools Service
 * Provides tool functions for LLM to update context via tool calls
 * LLM-driven architecture: LLM decides what to update and when
 * @module orchestrator/langgraph/dag-context-tools
 */

import type { DAGContext } from './dag-types.js';

/**
 * Context Update Tool Definition for LLM
 * This tool allows LLM to update any field in the context JSON
 */
export const CONTEXT_UPDATE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'update_context',
    description: `Update the conversation context JSON. Use this tool to:
- Set customer information (customer_name, customer_phone_number, customer_email, customer_address)
- Set issue details (customers_main_ask, matching_service_catalog_to_solve_customers_issue)
- Set flags (greet_flag: 1 when greeting done, identify_issue_flag: 1 when issue identified, etc.)
- Set planning info (task_id, appointment_details, next_steps_plans_help_customer)
- Set execution results (execution_results)
- Update any other context field

Rules:
- Always set flags to 1 when completing a step
- Use 0 to reset a flag
- Preserve existing values unless explicitly updating
- For mandatory fields (customers_main_ask, customer_phone_number), ensure they are set`,
    parameters: {
      type: 'object',
      properties: {
        field_name: {
          type: 'string',
          description: 'The context field to update (e.g., "customer_name", "customers_main_ask", "flags.greet_flag")',
          enum: [
            'customer_name',
            'customer_phone_number',
            'customer_email',
            'customer_address',
            'customer_id',
            'customers_main_ask',
            'matching_service_catalog_to_solve_customers_issue',
            'related_entities_for_customers_ask',
            'task_id',
            'appointment_details',
            'next_steps_plans_help_customer',
            'execution_results',
            'flags.greet_flag',
            'flags.ask_need_flag',
            'flags.identify_issue_flag',
            'flags.empathize_flag',
            'flags.rapport_flag',
            'flags.data_name_flag',
            'flags.data_phone_flag',
            'flags.data_email_flag',
            'flags.data_address_flag',
            'flags.check_customer_flag',
            'flags.plan_flag',
            'flags.communicate_plan_flag',
            'flags.execute_flag',
            'flags.tell_execution_flag',
            'flags.goodbye_flag',
          ],
        },
        field_value: {
          type: 'string',
          description: 'The value to set (for flags, use "1" for true, "0" for false)',
        },
        reason: {
          type: 'string',
          description: 'Brief reason for this update (for logging/debugging)',
        },
      },
      required: ['field_name', 'field_value', 'reason'],
    },
  },
};

/**
 * Build routing decision tool from DAG configuration
 * All knowledge comes from dag.json
 */
export function buildRoutingDecisionTool(dagConfig: any) {
  // Extract node names from dag.json
  const nodeNames = dagConfig.nodes.map((n: any) => n.node_name);
  nodeNames.push('END'); // Add special END node

  // Build description from dag.json routing config
  const routingInstructions = dagConfig.routing_config.llm_routing_instructions || 'Analyze context and decide next node';
  const routingHints = dagConfig.routing_config.routing_hints || {};

  // Build full description
  let description = `${routingInstructions}\n\nRouting Hints (from configuration):\n`;
  for (const [key, value] of Object.entries(routingHints)) {
    description += `- ${key}: ${value}\n`;
  }

  return {
    type: 'function' as const,
    function: {
      name: 'decide_next_node',
      description,
      parameters: {
        type: 'object',
        properties: {
          next_node: {
            type: 'string',
            description: 'The next node to execute',
            enum: nodeNames,
          },
          reason: {
            type: 'string',
            description: 'Brief explanation for this routing decision',
          },
          skip_reason: {
            type: 'string',
            description: 'If skipping nodes, explain why (e.g., "greet_flag=1, already greeted")',
          },
        },
        required: ['next_node', 'reason'],
      },
    },
  };
}

/**
 * Context Tools Service
 * Executes tool calls from LLM to update context
 */
export class DAGContextToolsService {
  private dagConfig: any;

  constructor(dagConfig: any) {
    this.dagConfig = dagConfig;
  }
  /**
   * Execute context update tool call from LLM
   */
  executeContextUpdate(
    context: DAGContext,
    fieldName: string,
    fieldValue: string,
    reason: string
  ): { context: DAGContext; success: boolean; message: string } {
    try {
      const updatedContext = { ...context };

      console.log(`[Context Tool] 🔧 Updating: ${fieldName} = "${fieldValue}" (reason: ${reason})`);

      // Handle nested flag updates (flags.greet_flag)
      if (fieldName.startsWith('flags.')) {
        const flagName = fieldName.split('.')[1];
        const flagValue = fieldValue === '1' ? 1 : 0;

        updatedContext.flags = {
          ...(updatedContext.flags || {}),
          [flagName]: flagValue,
        };

        console.log(`[Context Tool] ✅ Flag updated: ${flagName} = ${flagValue}`);

        return {
          context: updatedContext,
          success: true,
          message: `Updated ${flagName} to ${flagValue}`,
        };
      }

      // Handle direct field updates
      if (fieldName in updatedContext) {
        // Type conversion for specific fields
        if (fieldName === 'related_entities_for_customers_ask') {
          // Parse as array if JSON array string
          try {
            updatedContext[fieldName] = JSON.parse(fieldValue);
          } catch {
            updatedContext[fieldName] = fieldValue;
          }
        } else {
          updatedContext[fieldName] = fieldValue;
        }

        console.log(`[Context Tool] ✅ Field updated: ${fieldName} = "${fieldValue}"`);

        return {
          context: updatedContext,
          success: true,
          message: `Updated ${fieldName}`,
        };
      }

      // Unknown field
      console.warn(`[Context Tool] ⚠️  Unknown field: ${fieldName}`);
      return {
        context,
        success: false,
        message: `Unknown field: ${fieldName}`,
      };
    } catch (error: any) {
      console.error(`[Context Tool] ❌ Error updating context:`, error.message);
      return {
        context,
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Get all available tools for LLM
   */
  getAvailableTools() {
    return [CONTEXT_UPDATE_TOOL];
  }

  /**
   * Get routing decision tool (built from dag.json)
   */
  getRoutingTool() {
    return buildRoutingDecisionTool(this.dagConfig);
  }

  /**
   * Execute tool call from LLM response
   */
  executeToolCall(
    context: DAGContext,
    toolName: string,
    toolArgs: Record<string, any>
  ): { context: DAGContext; success: boolean; message: string } {
    if (toolName === 'update_context') {
      return this.executeContextUpdate(
        context,
        toolArgs.field_name,
        toolArgs.field_value,
        toolArgs.reason || 'LLM decision'
      );
    }

    return {
      context,
      success: false,
      message: `Unknown tool: ${toolName}`,
    };
  }

  /**
   * Process multiple tool calls from LLM
   */
  executeToolCalls(
    context: DAGContext,
    toolCalls: Array<{ name: string; arguments: Record<string, any> }>
  ): DAGContext {
    let updatedContext = context;

    for (const toolCall of toolCalls) {
      const result = this.executeToolCall(updatedContext, toolCall.name, toolCall.arguments);
      if (result.success) {
        updatedContext = result.context;
      } else {
        console.error(`[Context Tool] Tool call failed: ${result.message}`);
      }
    }

    return updatedContext;
  }
}

/**
 * Create new context tools instance
 * No singleton to avoid stale config issues
 */
export function createDAGContextTools(dagConfig: any): DAGContextToolsService {
  return new DAGContextToolsService(dagConfig);
}
