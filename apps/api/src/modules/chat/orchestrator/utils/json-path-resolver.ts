/**
 * JSON Path Resolver for Session Memory
 *
 * Resolves JSON paths from session memory context to actual values
 * Supports both ConversationContextV3 (hierarchical) and flat DAGContext
 *
 * Examples:
 * - "customer.phone" → resolves to customer.phone value
 * - "service.urgency_level" → resolves to service urgency value
 * - "operations.task_id" → resolves to task ID
 *
 * @module orchestrator/utils/json-path-resolver
 * @version 3.0.0
 */

import type { ConversationContextV3 } from '../config/agent-config.schema.js';
import type { DAGContext } from '../agents/dag-types.js';

/**
 * Resolve JSON path from ConversationContextV3 (hierarchical structure)
 */
export function resolveJsonPath(
  context: ConversationContextV3 | DAGContext,
  jsonPath: string
): any {
  if (!jsonPath) {
    return undefined;
  }

  const parts = jsonPath.split('.');
  let current: any = context;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }

    // Handle both hierarchical (ConversationContextV3) and flat (DAGContext) structures
    if (part in current) {
      current = current[part];
    } else if ('data_extraction_fields' in current && part in current.data_extraction_fields) {
      // Fallback: Check flat DAGContext structure
      current = current.data_extraction_fields[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Check if a value is considered "set" (not null, undefined, or empty)
 */
export function isValueSet(value: any): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }

  if (typeof value === 'string' && (value === '(not set)' || value === '(unknown)' || value === '(missing)')) {
    return false;
  }

  return true;
}

/**
 * Evaluate deterministic condition
 *
 * Supports operators:
 * - is_set / is_not_set
 * - == / !=
 * - > / < / >= / <=
 */
export function evaluateDeterministicCondition(
  context: ConversationContextV3 | DAGContext,
  jsonPath: string,
  operator: string,
  expectedValue?: string | number | boolean
): boolean {
  const actualValue = resolveJsonPath(context, jsonPath);

  switch (operator) {
    case 'is_set':
      return isValueSet(actualValue);

    case 'is_not_set':
      return !isValueSet(actualValue);

    case '==':
      return actualValue === expectedValue;

    case '!=':
      return actualValue !== expectedValue;

    case '>':
      if (typeof actualValue === 'number' && typeof expectedValue === 'number') {
        return actualValue > expectedValue;
      }
      return false;

    case '<':
      if (typeof actualValue === 'number' && typeof expectedValue === 'number') {
        return actualValue < expectedValue;
      }
      return false;

    case '>=':
      if (typeof actualValue === 'number' && typeof expectedValue === 'number') {
        return actualValue >= expectedValue;
      }
      return false;

    case '<=':
      if (typeof actualValue === 'number' && typeof expectedValue === 'number') {
        return actualValue <= expectedValue;
      }
      return false;

    default:
      console.warn(`[JsonPathResolver] Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Replace placeholders in text with session memory values
 *
 * Examples:
 * - "Customer {{customer.name}} requested {{service.primary_request}}"
 * - "Task ID: {{operations.task_id}}"
 */
export function replacePlaceholders(
  text: string,
  context: ConversationContextV3 | DAGContext
): string {
  // Match {{json.path}} patterns
  const placeholderRegex = /\{\{([^}]+)\}\}/g;

  return text.replace(placeholderRegex, (match, jsonPath) => {
    const value = resolveJsonPath(context, jsonPath.trim());

    if (value === undefined || value === null) {
      return '(not set)';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}
