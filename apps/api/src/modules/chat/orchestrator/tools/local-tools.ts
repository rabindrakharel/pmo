/**
 * Local MCP Tools for Orchestrator
 * These are internal tools that LLM can call to update context/state
 * They execute locally (not via HTTP API)
 * @module orchestrator/tools/local-tools
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { AgentContextState } from '../agents/agent-context.service.js';

/**
 * Tool: updateContext
 * Allows LLM to update context fields based on conversation analysis
 */
export const UPDATE_CONTEXT_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'updateContext',
    description: `Update context fields based on information extracted from the conversation.

WHEN TO USE THIS TOOL:
- After analyzing the last 4 conversation exchanges
- When you identify customer information that's not yet in context
- When customer provides name, phone, email, or describes their issue

AVAILABLE CONTEXT FIELDS TO UPDATE (nested structure):
- customer.name: Customer's full name
- customer.phone: Phone number (format: 555-1234 or (555) 123-4567)
- customer.email: Email address
- service.primary_request: The main issue/service customer needs (be specific, 5-10 words)

EXTRACTION RULES:
1. Use NESTED field names: customer.name, customer.phone, service.primary_request
2. ONLY extract information explicitly mentioned by customer
3. Do NOT extract from agent responses (agent doesn't provide customer data)
4. Do NOT make assumptions or infer information
5. Be precise and concise
6. Extract ALL available fields in ONE call (don't call multiple times)

EXAMPLES:

Example 1 - Name extraction:
Conversation:
Customer: "My name is John Smith"
Agent: "Thank you, John"

Tool call:
updateContext({
  "customer.name": "John Smith"
})

---

Example 2 - Multiple fields:
Conversation:
Customer: "I'm Jane Doe, my number is 555-1234, and I need help with a leaking roof"
Agent: "I can help with that roof issue"

Tool call:
updateContext({
  "customer.name": "Jane Doe",
  "customer.phone": "555-1234",
  "service.primary_request": "Roof leak repair"
})

---

Example 3 - Issue only:
Conversation:
Customer: "The backyard has a hole that needs to be patched"
Agent: "I understand, we can help patch that hole"

Tool call:
updateContext({
  "service.primary_request": "Backyard hole repair/patching"
})

---

Example 4 - Nothing to extract:
Conversation:
Customer: "I'm feeling good today, it's sunny"
Agent: "That's great to hear!"

NO TOOL CALL - no customer data to extract

IMPORTANT:
- Use nested field names (dot notation)
- Call this tool AFTER generating your response to the customer
- Only call if you found NEW information (check current context first)
- Extract from CUSTOMER messages only, not agent messages`,
    parameters: {
      type: 'object',
      properties: {
        'customer.name': {
          type: 'string',
          description: 'Customer full name (if mentioned in conversation)',
        },
        'customer.phone': {
          type: 'string',
          description: 'Customer phone number (if mentioned in conversation)',
        },
        'customer.email': {
          type: 'string',
          description: 'Customer email address (if mentioned in conversation)',
        },
        'service.primary_request': {
          type: 'string',
          description: 'Main issue or service customer needs (5-10 words, specific)',
        },
      },
      required: [], // All fields optional - only include what was found
    },
  },
};

/**
 * Execute updateContext tool locally
 * Updates fields within data_extraction_fields nested object
 * ✅ Now supports nested paths: customer.name, service.primary_request, etc.
 */
export async function executeUpdateContext(
  state: AgentContextState,
  toolArgs: Record<string, any>
): Promise<{ success: boolean; fieldsUpdated: string[]; updates: Record<string, any> }> {
  console.log(`\n🔧 [LocalTool:updateContext] Executing context update...`);
  console.log(`   Arguments: ${JSON.stringify(toolArgs, null, 2)}`);

  const fieldsUpdated: string[] = [];

  // Get current data_extraction_fields object (or initialize if missing with nested structure)
  const currentDataFields = state.context.data_extraction_fields || {
    customer: {},
    service: {},
    operations: {},
    project: {},
    assignment: {}
  };

  // Deep copy to avoid mutation
  const updatedDataFields = JSON.parse(JSON.stringify(currentDataFields));

  // Process each field in tool arguments (supports nested paths like "customer.name")
  for (const [key, value] of Object.entries(toolArgs)) {
    // Skip empty values
    if (value === null || value === undefined || value === '') {
      continue;
    }

    // Parse nested path (e.g., "customer.name" → ["customer", "name"])
    const pathParts = key.split('.');

    if (pathParts.length === 2) {
      // Nested field: customer.name, service.primary_request, etc.
      const [category, field] = pathParts;

      // Initialize category if missing
      if (!updatedDataFields[category]) {
        updatedDataFields[category] = {};
      }

      // Get current value for comparison
      const currentValue = currentDataFields[category]?.[field];

      // Only update if value is different from current
      if (currentValue !== value) {
        updatedDataFields[category][field] = value;
        fieldsUpdated.push(key);
        console.log(`   ✓ data_extraction_fields.${key}: "${currentValue || '(empty)'}" → "${value}"`);
      } else {
        console.log(`   ⊘ data_extraction_fields.${key}: Already set to "${value}" (skipping)`);
      }
    } else {
      // Flat field (backward compatibility - should not happen with new tool schema)
      console.warn(`   ⚠️ Flat field detected: "${key}" - prefer nested paths (e.g., "customer.name")`);
      if (currentDataFields[key] !== value) {
        updatedDataFields[key] = value;
        fieldsUpdated.push(key);
        console.log(`   ✓ data_extraction_fields.${key}: "${currentDataFields[key] || '(empty)'}" → "${value}"`);
      }
    }
  }

  if (fieldsUpdated.length > 0) {
    console.log(`[LocalTool:updateContext] ✅ Updated ${fieldsUpdated.length} fields:`, fieldsUpdated);
  } else {
    console.log(`[LocalTool:updateContext] ℹ️  No fields updated (all values unchanged)`);
  }

  // Return updates with nested structure
  const updates = {
    data_extraction_fields: updatedDataFields
  };

  return {
    success: true,
    fieldsUpdated,
    updates,
  };
}

/**
 * Get all local tools for orchestrator agents
 */
export function getLocalTools(): ChatCompletionTool[] {
  return [UPDATE_CONTEXT_TOOL];
}
