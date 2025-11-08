/**
 * Context Update MCP Service
 * Factory MCP that intelligently updates context by analyzing conversation
 *
 * Flow:
 * 1. Pulls last 4 conversation exchanges from context
 * 2. Asks LLM to identify what context fields need updating
 * 3. LLM returns updateContext({key1: value1, key2: value2})
 * 4. MCP executes the updates locally
 *
 * @module orchestrator/agents/context-update-mcp
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { DAGContext } from './dag-types.js';

/**
 * Context Update Result
 */
export interface ContextUpdateResult {
  updates: Record<string, any>;
  fieldsUpdated: string[];
  extractionReason: string;
}

/**
 * Context Update MCP Service
 * Intelligently extracts and updates context from conversation
 */
export class ContextUpdateMCP {
  /**
   * Analyze recent conversation and update context fields
   */
  async updateContextFromConversation(
    state: AgentContextState,
    initialContextTemplate: any
  ): Promise<ContextUpdateResult> {
    console.log(`\n🔍 [ContextUpdateMCP] Analyzing conversation for context updates...`);

    // Get last 4 conversation exchanges
    const conversationHistory = state.context.summary_of_conversation_on_each_step_until_now || [];
    const recentExchanges = conversationHistory.slice(-4);

    if (recentExchanges.length === 0) {
      console.log(`[ContextUpdateMCP] No conversation history - skipping`);
      return {
        updates: {},
        fieldsUpdated: [],
        extractionReason: 'No conversation history available'
      };
    }

    // Get available context fields from template
    const availableFields = Object.keys(initialContextTemplate.template || {});
    const currentContext = state.context;

    // Build prompt for LLM to extract context updates
    const systemPrompt = this.buildExtractionPrompt(availableFields, currentContext);
    const userPrompt = this.buildConversationPrompt(recentExchanges);

    // Call LLM to extract context updates
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      sessionId: state.sessionId,
      jsonMode: true, // CRITICAL: Get structured output
    });

    // Parse the extraction result
    let extractedData: any = {};
    try {
      extractedData = JSON.parse(result.content || '{}');
    } catch (error) {
      console.error(`[ContextUpdateMCP] Failed to parse LLM response:`, error);
      return {
        updates: {},
        fieldsUpdated: [],
        extractionReason: 'Failed to parse LLM response'
      };
    }

    // Prepare updates (only non-empty values)
    const updates: Record<string, any> = {};
    const fieldsUpdated: string[] = [];

    for (const [key, value] of Object.entries(extractedData)) {
      if (key === 'extraction_reason') continue; // Skip metadata field

      // Only update if:
      // 1. Value is not empty/null
      // 2. Field exists in template
      // 3. Value is different from current value
      if (
        value !== null &&
        value !== '' &&
        availableFields.includes(key) &&
        currentContext[key] !== value
      ) {
        updates[key] = value;
        fieldsUpdated.push(key);
      }
    }

    console.log(`[ContextUpdateMCP] ✅ Extracted ${fieldsUpdated.length} field updates:`, fieldsUpdated);
    if (fieldsUpdated.length > 0) {
      console.log(`[ContextUpdateMCP] 📝 Updates:`, JSON.stringify(updates, null, 2));
    }

    return {
      updates,
      fieldsUpdated,
      extractionReason: extractedData.extraction_reason || 'Automatic extraction from conversation'
    };
  }

  /**
   * Build extraction prompt for LLM
   */
  private buildExtractionPrompt(availableFields: string[], currentContext: DAGContext): string {
    return `You are a context extraction specialist.

Your task: Analyze the recent conversation and extract information to update the context JSON.

AVAILABLE CONTEXT FIELDS:
${availableFields.map(f => `  - ${f}`).join('\n')}

CURRENT CONTEXT VALUES (only update if new information is found):
${JSON.stringify(currentContext, null, 2)}

EXTRACTION RULES:
1. ONLY extract information explicitly mentioned in the conversation
2. Do NOT make assumptions or infer information
3. Do NOT update fields that are already populated (unless customer explicitly corrects them)
4. Extract ALL relevant fields in one pass (name, phone, email, issue, etc.)
5. Be precise and concise in your extractions

EXAMPLES:

Conversation:
Customer: "My name is John Smith"
Agent: "Thank you, John"

Extract:
{
  "customer_name": "John Smith",
  "extraction_reason": "Customer stated their name"
}

---

Conversation:
Customer: "I need help with my leaking roof"
Agent: "I can help with that"

Extract:
{
  "customers_main_ask": "Roof leak repair",
  "extraction_reason": "Customer described their issue"
}

---

Conversation:
Customer: "My number is 555-1234 and I need landscaping done"
Agent: "Got it, we can help"

Extract:
{
  "customer_phone_number": "555-1234",
  "customers_main_ask": "Landscaping service needed",
  "extraction_reason": "Customer provided phone and stated service need"
}

OUTPUT FORMAT (JSON):
{
  "field_name": "extracted_value",
  "another_field": "another_value",
  "extraction_reason": "brief reason for extraction"
}

If nothing to extract, return:
{
  "extraction_reason": "No new information found in conversation"
}`;
  }

  /**
   * Build conversation prompt for LLM
   */
  private buildConversationPrompt(exchanges: Array<{ customer: string; agent: string }>): string {
    const formattedExchanges = exchanges.map((exchange, idx) => {
      return `[Exchange ${idx + 1}]\nCustomer: "${exchange.customer}"\nAgent: "${exchange.agent}"`;
    }).join('\n\n');

    return `Analyze this recent conversation and extract any context information:

${formattedExchanges}

Extract all relevant information and return as JSON.`;
  }
}
