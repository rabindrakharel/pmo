/**
 * Worker Agent
 * Executes tasks via MCP tools and collects user data
 * @module orchestrator/agents/worker
 */

import type { AgentActionResult, NodeAction } from '../types/intent-graph.types.js';
import { stateManager } from '../state/state-manager.service.js';
import { executeMCPTool } from '../../mcp-adapter.service.js';

/**
 * Worker Agent
 * Performs actual task execution according to intent graph
 */
export class WorkerAgent {
  /**
   * Execute an action defined in the intent graph node
   */
  async executeAction(args: {
    sessionId: string;
    nodeContext: string;
    action: NodeAction;
    state: Record<string, any>;
    authToken?: string;
    userMessage?: string;
  }): Promise<AgentActionResult> {
    const startTime = Date.now();

    try {
      let result: AgentActionResult;

      switch (args.action.type) {
        case 'mcp_call':
          result = await this.executeMCPCall(args);
          break;

        case 'collect_data':
          result = await this.collectData(args);
          break;

        case 'present_options':
          result = await this.presentOptions(args);
          break;

        case 'confirm':
          result = await this.confirm(args);
          break;

        case 'summarize':
          result = await this.summarize(args);
          break;

        default:
          throw new Error(`Unknown action type: ${args.action.type}`);
      }

      // Log the action
      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'worker',
        agent_action: `execute_${args.action.type}`,
        node_context: args.nodeContext,
        input_data: { action: args.action, state_keys: Object.keys(args.state) },
        output_data: result.stateUpdates,
        success: result.success,
        error_message: result.error,
        natural_response: result.naturalResponse,
        duration_ms: Date.now() - startTime
      });

      return result;
    } catch (error: any) {
      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'worker',
        agent_action: `execute_${args.action.type}`,
        node_context: args.nodeContext,
        success: false,
        error_message: error.message,
        duration_ms: Date.now() - startTime
      });

      return {
        success: false,
        agentRole: 'worker',
        action: `execute_${args.action.type}`,
        error: error.message,
        naturalResponse: 'I encountered an error while processing your request. Let me try again.'
      };
    }
  }

  /**
   * Execute an MCP tool call
   */
  private async executeMCPCall(args: {
    sessionId: string;
    nodeContext: string;
    action: NodeAction;
    state: Record<string, any>;
    authToken?: string;
  }): Promise<AgentActionResult> {
    if (!args.action.mcpTool) {
      throw new Error('MCP tool name not specified');
    }

    if (!args.authToken) {
      return {
        success: false,
        agentRole: 'worker',
        action: 'mcp_call',
        error: 'Authentication required for MCP tool calls',
        naturalResponse: 'I need you to be logged in to perform this action.'
      };
    }

    // Map input parameters from state
    const mcpArgs: Record<string, any> = {};
    if (args.action.inputMapping) {
      for (const [paramKey, stateKey] of Object.entries(args.action.inputMapping)) {
        // Handle literal values (quoted strings)
        if (stateKey.startsWith('"') && stateKey.endsWith('"')) {
          mcpArgs[paramKey] = stateKey.slice(1, -1);
        }
        // Handle array indexing (e.g., "customers[0].id")
        else if (stateKey.includes('[') || stateKey.includes('.')) {
          mcpArgs[paramKey] = this.resolveNestedPath(args.state, stateKey);
        }
        // Direct state lookup
        else {
          mcpArgs[paramKey] = args.state[stateKey];
        }
      }
    }

    console.log(`🔧 Worker executing MCP tool: ${args.action.mcpTool}`, { args: mcpArgs });

    // Execute MCP tool
    try {
      const result = await executeMCPTool(args.action.mcpTool, mcpArgs, args.authToken);

      console.log(`✅ MCP tool ${args.action.mcpTool} succeeded:`, result);

      // Map output to state variables
      const stateUpdates: Record<string, any> = {};
      if (args.action.outputMapping) {
        for (const [stateKey, resultPath] of Object.entries(args.action.outputMapping)) {
          stateUpdates[stateKey] = this.resolveNestedPath(result, resultPath);
        }
      }

      // Persist state updates
      for (const [key, value] of Object.entries(stateUpdates)) {
        if (value !== undefined && value !== null) {
          await stateManager.setState(args.sessionId, key, value, {
            source: 'worker',
            node_context: args.nodeContext,
            validated: false
          });
        }
      }

      // Log MCP call
      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'worker',
        agent_action: 'mcp_call',
        node_context: args.nodeContext,
        mcp_tool_name: args.action.mcpTool,
        mcp_tool_args: mcpArgs,
        mcp_tool_result: result,
        mcp_success: true,
        success: true
      });

      return {
        success: true,
        agentRole: 'worker',
        action: 'mcp_call',
        stateUpdates,
        naturalResponse: this.generateMCPResponse(args.action.mcpTool, result, stateUpdates)
      };
    } catch (error: any) {
      console.error(`❌ MCP tool ${args.action.mcpTool} failed:`, error.message);

      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'worker',
        agent_action: 'mcp_call',
        node_context: args.nodeContext,
        mcp_tool_name: args.action.mcpTool,
        mcp_tool_args: mcpArgs,
        mcp_success: false,
        success: false,
        error_message: error.message
      });

      return {
        success: false,
        agentRole: 'worker',
        action: 'mcp_call',
        error: error.message,
        naturalResponse: `I had trouble ${this.getMCPActionDescription(args.action.mcpTool)}. Let me try another approach.`
      };
    }
  }

  /**
   * Collect data from user
   */
  private async collectData(args: {
    sessionId: string;
    nodeContext: string;
    action: NodeAction;
    state: Record<string, any>;
    userMessage?: string;
  }): Promise<AgentActionResult> {
    if (!args.action.collectFields) {
      throw new Error('No collect fields specified');
    }

    // Check which fields are missing
    const missingFields = args.action.collectFields.filter(
      field => !args.state[field.key] && field.required
    );

    if (missingFields.length === 0) {
      // All required fields collected
      return {
        success: true,
        agentRole: 'worker',
        action: 'collect_data',
        naturalResponse: 'Great! I have all the information I need.'
      };
    }

    // If we have a user message, try to extract data from it
    const stateUpdates: Record<string, any> = {};
    if (args.userMessage) {
      // Simple extraction (in production, use NER or structured extraction)
      for (const field of args.action.collectFields) {
        if (!args.state[field.key]) {
          const extracted = this.extractFieldFromMessage(
            args.userMessage,
            field.key,
            field.type
          );
          if (extracted) {
            stateUpdates[field.key] = extracted;

            await stateManager.setState(args.sessionId, field.key, extracted, {
              source: 'worker',
              node_context: args.nodeContext,
              validated: false
            });
          }
        }
      }
    }

    // Still have missing fields - ask for the first one
    const nextField = missingFields[0];

    return {
      success: true,
      agentRole: 'worker',
      action: 'collect_data',
      stateUpdates,
      naturalResponse: nextField.prompt || `Can you provide your ${nextField.key}?`,
      requiresUserInput: true
    };
  }

  /**
   * Present options to user
   */
  private async presentOptions(args: {
    sessionId: string;
    nodeContext: string;
    action: NodeAction;
    state: Record<string, any>;
  }): Promise<AgentActionResult> {
    const prompt = args.action.prompt || 'Please select from the following options:';

    // Replace template variables
    const renderedPrompt = this.renderTemplate(prompt, args.state);

    return {
      success: true,
      agentRole: 'worker',
      action: 'present_options',
      naturalResponse: renderedPrompt,
      requiresUserInput: true
    };
  }

  /**
   * Confirm action with user
   */
  private async confirm(args: {
    sessionId: string;
    nodeContext: string;
    action: NodeAction;
    state: Record<string, any>;
  }): Promise<AgentActionResult> {
    const prompt = args.action.prompt || 'Is this correct?';
    const renderedPrompt = this.renderTemplate(prompt, args.state);

    return {
      success: true,
      agentRole: 'worker',
      action: 'confirm',
      naturalResponse: renderedPrompt,
      requiresUserInput: true
    };
  }

  /**
   * Summarize session
   */
  private async summarize(args: {
    sessionId: string;
    nodeContext: string;
    action: NodeAction;
    state: Record<string, any>;
  }): Promise<AgentActionResult> {
    // Generate summary from state
    const summary = this.generateSummary(args.state);

    return {
      success: true,
      agentRole: 'worker',
      action: 'summarize',
      naturalResponse: summary
    };
  }

  // ========================================
  // Helper Methods
  // ========================================

  private resolveNestedPath(obj: any, path: string): any {
    // Handle array indexing: customers[0].id
    const arrayMatch = path.match(/([^\[]+)\[(\d+)\]\.(.+)/);
    if (arrayMatch) {
      const [, arrayKey, index, subPath] = arrayMatch;
      const array = obj[arrayKey];
      if (Array.isArray(array) && array.length > parseInt(index)) {
        return this.resolveNestedPath(array[parseInt(index)], subPath);
      }
      return undefined;
    }

    // Handle dot notation: user.name
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private renderTemplate(template: string, state: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.resolveNestedPath(state, key.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private extractFieldFromMessage(
    message: string,
    fieldKey: string,
    fieldType: string
  ): any | null {
    // Simple extraction logic (in production, use NLP/NER)
    const lowerMessage = message.toLowerCase();

    // Phone number extraction
    if (fieldKey.includes('phone')) {
      const phoneMatch = message.match(/(\d{3}[-.]?\d{3}[-.]?\d{4}|\+?1?\d{10})/);
      if (phoneMatch) return phoneMatch[0].replace(/\D/g, '');
    }

    // Email extraction
    if (fieldKey.includes('email')) {
      const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) return emailMatch[0];
    }

    // Date extraction (simple YYYY-MM-DD)
    if (fieldType === 'date') {
      const dateMatch = message.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) return dateMatch[0];
    }

    // Name extraction (if message is just a name)
    if (fieldKey.includes('name') && !lowerMessage.includes(' and ') && message.trim().split(' ').length <= 3) {
      return message.trim();
    }

    return null;
  }

  private generateMCPResponse(toolName: string, result: any, stateUpdates: Record<string, any>): string {
    if (toolName.includes('create')) {
      return 'Done! I\'ve created that record.';
    }
    if (toolName.includes('list') || toolName.includes('search')) {
      return 'Let me check that for you...';
    }
    if (toolName.includes('update')) {
      return 'Updated successfully!';
    }
    return 'Operation completed.';
  }

  private getMCPActionDescription(toolName: string): string {
    if (toolName.includes('customer')) return 'looking up customer information';
    if (toolName.includes('employee')) return 'checking employee availability';
    if (toolName.includes('task')) return 'creating the task';
    if (toolName.includes('booking')) return 'creating the booking';
    return 'processing that request';
  }

  private generateSummary(state: Record<string, any>): string {
    // Generate a natural language summary from state
    const parts: string[] = [];

    if (state.customer_name) parts.push(`Customer: ${state.customer_name}`);
    if (state.service_category) parts.push(`Service: ${state.service_category}`);
    if (state.desired_date) parts.push(`Date: ${state.desired_date}`);
    if (state.task_code) parts.push(`Booking #: ${state.task_code}`);

    return parts.join(' | ');
  }
}

// Export singleton instance
export const workerAgent = new WorkerAgent();
