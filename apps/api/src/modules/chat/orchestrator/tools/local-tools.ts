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

AVAILABLE CONTEXT FIELDS TO UPDATE:
- customer_name: Customer's full name
- customer_phone_number: Phone number (format: 555-1234 or (555) 123-4567)
- customer_email: Email address
- customers_main_ask: The main issue/service customer needs (be specific, 5-10 words)
- related_entities_for_customers_ask: Related entities or keywords
- matching_service_catalog_to_solve_customers_issue: Service type that matches their need

EXTRACTION RULES:
1. ONLY extract information explicitly mentioned by customer
2. Do NOT extract from agent responses (agent doesn't provide customer data)
3. Do NOT make assumptions or infer information
4. Be precise and concise
5. Extract ALL available fields in ONE call (don't call multiple times)

EXAMPLES:

Example 1 - Name extraction:
Conversation:
Customer: "My name is John Smith"
Agent: "Thank you, John"

Tool call:
updateContext({
  "customer_name": "John Smith"
})

---

Example 2 - Multiple fields:
Conversation:
Customer: "I'm Jane Doe, my number is 555-1234, and I need help with a leaking roof"
Agent: "I can help with that roof issue"

Tool call:
updateContext({
  "customer_name": "Jane Doe",
  "customer_phone_number": "555-1234",
  "customers_main_ask": "Roof leak repair"
})

---

Example 3 - Issue only:
Conversation:
Customer: "The backyard has a hole that needs to be patched"
Agent: "I understand, we can help patch that hole"

Tool call:
updateContext({
  "customers_main_ask": "Backyard hole repair/patching"
})

---

Example 4 - Nothing to extract:
Conversation:
Customer: "I'm feeling good today, it's sunny"
Agent: "That's great to hear!"

NO TOOL CALL - no customer data to extract

IMPORTANT:
- Call this tool AFTER generating your response to the customer
- Only call if you found NEW information (check current context first)
- Extract from CUSTOMER messages only, not agent messages`,
    parameters: {
      type: 'object',
      properties: {
        customer_name: {
          type: 'string',
          description: 'Customer full name (if mentioned in conversation)',
        },
        customer_phone_number: {
          type: 'string',
          description: 'Customer phone number (if mentioned in conversation)',
        },
        customer_email: {
          type: 'string',
          description: 'Customer email address (if mentioned in conversation)',
        },
        customers_main_ask: {
          type: 'string',
          description: 'Main issue or service customer needs (5-10 words, specific)',
        },
        related_entities_for_customers_ask: {
          type: 'string',
          description: 'Related entities or keywords for the customer request',
        },
        matching_service_catalog_to_solve_customers_issue: {
          type: 'string',
          description: 'Service type that matches their need (e.g., "Roofing", "Landscaping")',
        },
      },
      required: [], // All fields optional - only include what was found
    },
  },
};

/**
 * Execute updateContext tool locally
 * Updates fields within data_extraction_fields nested object
 */
export async function executeUpdateContext(
  state: AgentContextState,
  toolArgs: Record<string, any>
): Promise<{ success: boolean; fieldsUpdated: string[]; updates: Record<string, any> }> {
  console.log(`\n🔧 [LocalTool:updateContext] Executing context update...`);
  console.log(`   Arguments: ${JSON.stringify(toolArgs, null, 2)}`);

  const fieldsUpdated: string[] = [];

  // Get current data_extraction_fields object (or initialize if missing)
  const currentDataFields = state.context.data_extraction_fields || {};
  const updatedDataFields: Record<string, any> = { ...currentDataFields };

  // Process each field in tool arguments
  for (const [key, value] of Object.entries(toolArgs)) {
    // Skip empty values
    if (value === null || value === undefined || value === '') {
      continue;
    }

    // Only update if value is different from current
    if (currentDataFields[key] !== value) {
      updatedDataFields[key] = value;
      fieldsUpdated.push(key);
      console.log(`   ✓ data_extraction_fields.${key}: "${currentDataFields[key] || '(empty)'}" → "${value}"`);
    } else {
      console.log(`   ⊘ data_extraction_fields.${key}: Already set to "${value}" (skipping)`);
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
