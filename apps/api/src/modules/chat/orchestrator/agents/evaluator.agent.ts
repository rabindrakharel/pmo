/**
 * Evaluator Agent
 * Validates intermediate outputs and determines workflow progression
 * @module orchestrator/agents/evaluator
 */

import type { AgentActionResult, GraphNode, NodeValidation } from '../types/intent-graph.types.js';
import { stateManager } from '../state/state-manager.service.js';

/**
 * Evaluator Agent
 * Validates outputs against intent graph rules
 */
export class EvaluatorAgent {
  /**
   * Evaluate if node requirements are met
   */
  async evaluateNode(args: {
    sessionId: string;
    node: GraphNode;
    state: Record<string, any>;
    workerResult?: AgentActionResult;
  }): Promise<AgentActionResult> {
    const startTime = Date.now();

    try {
      const validationResults: Array<{
        validation: NodeValidation;
        passed: boolean;
        message?: string;
      }> = [];

      // Run all validations for this node
      if (args.node.validations && args.node.validations.length > 0) {
        for (const validation of args.node.validations) {
          const result = await this.runValidation(validation, args.state, args.workerResult);
          validationResults.push({
            validation,
            passed: result.passed,
            message: result.message
          });

          // Stop on first blocking failure
          if (!result.passed && validation.blocking) {
            await stateManager.logAgentAction({
              session_id: args.sessionId,
              agent_role: 'evaluator',
              agent_action: 'validate_node',
              node_context: args.node.id,
              input_data: { validation_type: validation.type },
              output_data: { passed: false, blocking: true },
              success: false,
              error_message: validation.errorMessage,
              duration_ms: Date.now() - startTime
            });

            return {
              success: false,
              agentRole: 'evaluator',
              action: 'validate_node',
              error: validation.errorMessage,
              naturalResponse: validation.errorMessage
            };
          }
        }
      }

      // Check required state fields
      if (args.node.requiredState && args.node.requiredState.length > 0) {
        const missingFields = args.node.requiredState.filter(
          field => args.state[field] === undefined || args.state[field] === null
        );

        if (missingFields.length > 0) {
          await stateManager.logAgentAction({
            session_id: args.sessionId,
            agent_role: 'evaluator',
            agent_action: 'validate_node',
            node_context: args.node.id,
            output_data: { missing_fields: missingFields },
            success: false,
            error_message: `Missing required fields: ${missingFields.join(', ')}`,
            duration_ms: Date.now() - startTime
          });

          return {
            success: false,
            agentRole: 'evaluator',
            action: 'validate_node',
            error: `Missing required information: ${missingFields.join(', ')}`,
            naturalResponse: `I still need some information to continue. Can you provide: ${missingFields.join(', ')}?`
          };
        }
      }

      // Mark validated fields in state
      if (args.node.producesState) {
        for (const field of args.node.producesState) {
          if (args.state[field] !== undefined) {
            await stateManager.setState(args.sessionId, field, args.state[field], {
              source: 'evaluator',
              node_context: args.node.id,
              validated: true
            });
          }
        }
      }

      // Determine next node based on transitions
      const nextNode = this.evaluateTransitions(args.node, args.state);

      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'evaluator',
        agent_action: 'validate_node',
        node_context: args.node.id,
        output_data: {
          validations_passed: validationResults.filter(v => v.passed).length,
          validations_failed: validationResults.filter(v => !v.passed).length,
          next_node: nextNode
        },
        success: true,
        natural_response: 'Node validation passed',
        duration_ms: Date.now() - startTime
      });

      return {
        success: true,
        agentRole: 'evaluator',
        action: 'validate_node',
        nextNode,
        naturalResponse: 'Validation successful, proceeding to next step.'
      };
    } catch (error: any) {
      await stateManager.logAgentAction({
        session_id: args.sessionId,
        agent_role: 'evaluator',
        agent_action: 'validate_node',
        node_context: args.node.id,
        success: false,
        error_message: error.message,
        duration_ms: Date.now() - startTime
      });

      return {
        success: false,
        agentRole: 'evaluator',
        action: 'validate_node',
        error: error.message
      };
    }
  }

  /**
   * Run a single validation rule
   */
  private async runValidation(
    validation: NodeValidation,
    state: Record<string, any>,
    workerResult?: AgentActionResult
  ): Promise<{ passed: boolean; message?: string }> {
    switch (validation.type) {
      case 'required_fields':
        return this.validateRequiredFields(validation, state);

      case 'data_format':
        return this.validateDataFormat(validation, state);

      case 'business_rule':
        return this.validateBusinessRule(validation, state);

      case 'mcp_success':
        return this.validateMCPSuccess(validation, workerResult);

      default:
        return { passed: true };
    }
  }

  /**
   * Validate required fields are present
   */
  private validateRequiredFields(
    validation: NodeValidation,
    state: Record<string, any>
  ): { passed: boolean; message?: string } {
    if (!validation.fields) {
      return { passed: true };
    }

    const missingFields = validation.fields.filter(
      field => state[field] === undefined || state[field] === null || state[field] === ''
    );

    if (missingFields.length > 0) {
      return {
        passed: false,
        message: `Missing: ${missingFields.join(', ')}`
      };
    }

    return { passed: true };
  }

  /**
   * Validate data format (regex, type checking)
   */
  private validateDataFormat(
    validation: NodeValidation,
    state: Record<string, any>
  ): { passed: boolean; message?: string } {
    if (!validation.fields || !validation.rule) {
      return { passed: true };
    }

    for (const field of validation.fields) {
      const value = state[field];
      if (value === undefined || value === null) continue;

      // Try to match regex rule
      try {
        const regex = new RegExp(validation.rule);
        if (!regex.test(String(value))) {
          return {
            passed: false,
            message: `Invalid format for ${field}`
          };
        }
      } catch (error) {
        console.error('Invalid regex in validation rule:', validation.rule);
      }
    }

    return { passed: true };
  }

  /**
   * Validate business rule (JavaScript expression)
   */
  private validateBusinessRule(
    validation: NodeValidation,
    state: Record<string, any>
  ): { passed: boolean; message?: string } {
    if (!validation.rule) {
      return { passed: true };
    }

    try {
      // Evaluate rule as JavaScript expression
      // In production, use a safe expression evaluator
      const passed = this.evaluateExpression(validation.rule, state);

      return {
        passed,
        message: passed ? undefined : validation.errorMessage
      };
    } catch (error) {
      console.error('Error evaluating business rule:', error);
      return { passed: true }; // Don't fail on evaluation errors
    }
  }

  /**
   * Validate MCP tool call succeeded
   */
  private validateMCPSuccess(
    validation: NodeValidation,
    workerResult?: AgentActionResult
  ): { passed: boolean; message?: string } {
    if (!workerResult) {
      return { passed: false, message: 'No worker result available' };
    }

    return {
      passed: workerResult.success === true,
      message: workerResult.success ? undefined : validation.errorMessage
    };
  }

  /**
   * Evaluate which transition to take
   */
  private evaluateTransitions(
    node: GraphNode,
    state: Record<string, any>
  ): string | undefined {
    if (!node.transitions || node.transitions.length === 0) {
      return undefined; // No transitions = end node
    }

    // Check conditional transitions first
    for (const transition of node.transitions) {
      if (transition.condition) {
        const conditionMet = this.evaluateExpression(transition.condition, state);
        if (conditionMet) {
          return transition.toNode;
        }
      }
    }

    // Fall back to default transition
    const defaultTransition = node.transitions.find(t => t.isDefault);
    return defaultTransition?.toNode;
  }

  /**
   * Evaluate a JavaScript expression safely
   * In production, use a proper expression evaluator like expr-eval
   */
  private evaluateExpression(expression: string, state: Record<string, any>): boolean {
    try {
      // Simple expression evaluation
      // Replace state variables
      let expr = expression;

      // Handle common comparisons
      if (expr.includes('!== null') || expr.includes('!== undefined')) {
        const varMatch = expr.match(/(\w+)\s*!==\s*(null|undefined)/);
        if (varMatch) {
          const varName = varMatch[1];
          return state[varName] !== null && state[varName] !== undefined;
        }
      }

      if (expr.includes('>= today')) {
        const varMatch = expr.match(/(\w+)\s*>=\s*today/);
        if (varMatch) {
          const varName = varMatch[1];
          const dateValue = state[varName];
          if (dateValue) {
            const today = new Date().toISOString().split('T')[0];
            return dateValue >= today;
          }
        }
      }

      // Array length check
      if (expr.includes('.length > 0')) {
        const varMatch = expr.match(/(\w+)\.length\s*>\s*0/);
        if (varMatch) {
          const varName = varMatch[1];
          const value = state[varName];
          return Array.isArray(value) && value.length > 0;
        }
      }

      // Existence check
      if (expr.includes('&&')) {
        const parts = expr.split('&&').map(p => p.trim());
        return parts.every(part => {
          const varName = part.replace(/[()]/g, '').trim();
          return state[varName] !== undefined && state[varName] !== null;
        });
      }

      // Simple variable existence
      const varName = expr.trim();
      if (varName in state) {
        return state[varName] !== undefined && state[varName] !== null;
      }

      return false;
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const evaluatorAgent = new EvaluatorAgent();
