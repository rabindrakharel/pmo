/**
 * Data Extraction and Context Update Agent
 * Specialized agent that analyzes conversation history and extracts context data
 * Called AFTER WorkerReplyAgent, WorkerMCPAgent, and Orchestrator complete
 *
 * Flow:
 * 1. Reads last 4 conversation exchanges from context.summary_of_conversation_on_each_step_until_now
 * 2. Analyzes what context fields are still empty
 * 3. Calls LLM with updateContext tool to extract any missing data
 * 4. Returns context updates to orchestrator
 *
 * @module orchestrator/agents/data-extraction-agent
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import { getLocalTools, executeUpdateContext } from '../tools/local-tools.js';

/**
 * Data Extraction Result
 */
export interface DataExtractionResult {
  contextUpdates?: Record<string, any>;
  fieldsUpdated?: string[];
  extractionReason: string;
}

/**
 * Data Extraction and Context Update Agent
 * Analyzes conversation and extracts missing context fields
 */
export class DataExtractionAgent {
  /**
   * Analyze conversation and extract missing context fields
   * This is called AFTER worker agents complete their work
   */
  async extractAndUpdateContext(state: AgentContextState): Promise<DataExtractionResult> {
    console.log(`\n🔍 [DataExtractionAgent] Analyzing conversation for context updates...`);

    // Try to get indexed summary first (preferred), fall back to messages array
    const indexedSummary = state.context.summary_of_conversation_on_each_step_until_now || [];
    let exchanges: Array<{ index?: number; customer: string; agent: string }> = [];

    if (indexedSummary.length > 0) {
      // Use indexed summary (already in exchange format with index)
      exchanges = indexedSummary.slice(-4); // Last 4 exchanges
      console.log(`[DataExtractionAgent] 📝 Analyzing last ${exchanges.length} conversation exchanges (from indexed summary)`);
      console.log(`[DataExtractionAgent] Exchange indices: ${exchanges.map((e: any) => e.index).join(', ')}`);
    } else {
      // Fall back to messages array for backward compatibility
      const allMessages = state.messages || [];
      const last8Messages = allMessages.slice(-8);

      if (last8Messages.length === 0) {
        console.log(`[DataExtractionAgent] No conversation history - skipping`);
        return {
          extractionReason: 'No conversation history available'
        };
      }

      // Convert messages to exchange format for analysis
      for (let i = 0; i < last8Messages.length; i += 2) {
        const userMsg = last8Messages[i];
        const agentMsg = last8Messages[i + 1];

        if (userMsg?.role === 'user' && agentMsg?.role === 'assistant') {
          exchanges.push({
            customer: userMsg.content,
            agent: agentMsg.content
          });
        }
      }

      exchanges = exchanges.slice(-4); // Last 4 exchanges
      console.log(`[DataExtractionAgent] 📝 Analyzing last ${exchanges.length} conversation exchanges (from messages array - fallback)`);
    }

    console.log(`[DataExtractionAgent] Exchanges:`, JSON.stringify(exchanges, null, 2));

    // Identify which context fields are still empty (nested under data_extraction_fields)
    const dataFields = state.context.data_extraction_fields || {};
    const allContextFields = [
      'customer_name',
      'customer_phone_number',
      'customer_email',
      'customers_main_ask',
      'matching_service_catalog_to_solve_customers_issue',
      'related_entities_for_customers_ask'
    ];

    const emptyFields = allContextFields.filter(
      field => !dataFields[field] || dataFields[field] === ''
    );

    console.log(`[DataExtractionAgent] 📊 Empty extraction fields: ${emptyFields.join(', ') || '(none)'}`);

    // If all fields are populated, skip extraction
    if (emptyFields.length === 0) {
      console.log(`[DataExtractionAgent] ✅ All extraction fields populated - skipping extraction`);
      return {
        extractionReason: 'All data extraction fields already populated'
      };
    }

    // Build prompt for LLM (exchanges already contains last 4)
    const systemPrompt = this.buildExtractionPrompt(exchanges, emptyFields, state.context);

    // 🔍 DEBUG: Log extraction prompt
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[DataExtractionAgent] 🔍 DEBUG: Extraction Prompt Preview`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(systemPrompt.substring(0, 500) + '...\n');

    // Get local tools for context updates
    const localTools = getLocalTools();

    // 🔍 DEBUG: Log tools available
    console.log(`[DataExtractionAgent] 🔍 DEBUG: Tools available: ${localTools.map((t: any) => t.function.name).join(', ')}`);

    // Call LLM with tool calling capability
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Analyze the conversation and extract any missing context fields.' },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      sessionId: state.sessionId,
      tools: localTools, // Give LLM access to updateContext tool
    });

    // 🔍 DEBUG: Log full LLM response
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[DataExtractionAgent] 🔍 DEBUG: LLM Response`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Content: ${result.content || '(no content)'}`);
    console.log(`   Tool Calls: ${result.tool_calls ? result.tool_calls.length : 0}`);
    if (result.tool_calls && result.tool_calls.length > 0) {
      result.tool_calls.forEach((tc: any, idx: number) => {
        console.log(`   [${idx + 1}] Tool: ${tc.function.name}`);
        console.log(`       Args: ${tc.function.arguments}`);
      });
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Handle tool calls if LLM made any
    let contextUpdates: Record<string, any> = {};
    let fieldsUpdated: string[] = [];

    if (result.tool_calls && result.tool_calls.length > 0) {
      console.log(`[DataExtractionAgent] 🔧 LLM called ${result.tool_calls.length} tool(s)`);

      for (const toolCall of result.tool_calls) {
        if (toolCall.function.name === 'updateContext') {
          console.log(`[DataExtractionAgent] 🔧 Processing updateContext call...`);
          console.log(`[DataExtractionAgent] 🔍 DEBUG: Raw arguments: ${toolCall.function.arguments}`);

          try {
            const toolArgs = JSON.parse(toolCall.function.arguments);
            console.log(`[DataExtractionAgent] 🔍 DEBUG: Parsed arguments:`, JSON.stringify(toolArgs, null, 2));

            const toolResult = await executeUpdateContext(state, toolArgs);

            console.log(`[DataExtractionAgent] 🔍 DEBUG: Tool execution result:`);
            console.log(`   Success: ${toolResult.success}`);
            console.log(`   Fields updated: ${toolResult.fieldsUpdated.join(', ')}`);
            console.log(`   Updates:`, JSON.stringify(toolResult.updates, null, 2));

            if (toolResult.success) {
              contextUpdates = { ...contextUpdates, ...toolResult.updates };
              fieldsUpdated = [...new Set([...fieldsUpdated, ...toolResult.fieldsUpdated])];
              console.log(`[DataExtractionAgent] ✅ Successfully extracted ${toolResult.fieldsUpdated.length} fields`);
            } else {
              console.error(`[DataExtractionAgent] ⚠️ Tool execution returned success=false`);
            }
          } catch (error: any) {
            console.error(`[DataExtractionAgent] ❌ Failed to parse tool arguments: ${error.message}`);
            console.error(`[DataExtractionAgent] 🔍 DEBUG: Error stack:`, error.stack);
          }
        }
      }
    } else {
      console.log(`[DataExtractionAgent] ℹ️  LLM did not call any tools - no extractable data found`);
      console.log(`[DataExtractionAgent] 🔍 DEBUG: This could mean:`);
      console.log(`   1. No phone number/name/data found in last 4 exchanges`);
      console.log(`   2. LLM decided all fields already populated`);
      console.log(`   3. LLM didn't understand the task`);
      console.log(`   4. Tool calling is not working properly`);
    }

    // Return results
    if (fieldsUpdated.length > 0) {
      console.log(`[DataExtractionAgent] 🎉 Extraction complete - ${fieldsUpdated.length} fields updated: ${fieldsUpdated.join(', ')}`);
      return {
        contextUpdates,
        fieldsUpdated,
        extractionReason: `Extracted ${fieldsUpdated.length} fields from last 4 conversation exchanges`
      };
    } else {
      console.log(`[DataExtractionAgent] ℹ️  No new information extracted from conversation`);
      return {
        extractionReason: 'No new extractable information found in recent conversation'
      };
    }
  }

  /**
   * Build extraction prompt for LLM
   */
  private buildExtractionPrompt(
    last4Exchanges: Array<{ index?: number; customer: string; agent: string }>,
    emptyFields: string[],
    currentContext: any
  ): string {
    const dataFields = currentContext.data_extraction_fields || {};

    return `You are a data extraction specialist for a customer service system.

Your task: Analyze the recent conversation exchanges and extract missing customer information.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 LAST 4 CONVERSATION EXCHANGES:
${last4Exchanges.map((exchange, idx) => {
  const exchangeLabel = exchange.index !== undefined ? `Exchange #${exchange.index}` : `Exchange ${idx + 1}`;
  return `[${exchangeLabel}]\nCustomer: "${exchange.customer}"\nAgent: "${exchange.agent}"`;
}).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 EMPTY DATA EXTRACTION FIELDS (not yet extracted):
${emptyFields.join(', ')}

🔍 CURRENT DATA EXTRACTION FIELDS (already populated):
${JSON.stringify(dataFields, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR TASK:

Based on the LAST 4 CONVERSATION EXCHANGES above:
1. Look for customer information that can fill EMPTY CONTEXT FIELDS
2. Extract information from CUSTOMER messages ONLY (not agent responses)
3. Do NOT make assumptions or infer information
4. Only extract information explicitly mentioned by the customer
5. If you find extractable information, call the updateContext tool

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 EXTRACTION EXAMPLES:

Example 1 - Name extraction:
Conversation:
Customer: "My name is John Smith"
Agent: "Thank you, John"

→ Call: updateContext({"customer_name": "John Smith"})

---

Example 2 - Multiple fields:
Conversation:
Customer: "I'm Jane Doe, my number is 555-1234, and I need help with a leaking roof"
Agent: "I can help with that roof issue"

→ Call: updateContext({
  "customer_name": "Jane Doe",
  "customer_phone_number": "555-1234",
  "customers_main_ask": "Roof leak repair"
})

---

Example 3 - Issue only:
Conversation:
Customer: "The backyard has a hole that needs to be patched"
Agent: "I understand, we can help patch that hole"

→ Call: updateContext({
  "customers_main_ask": "Backyard hole repair/patching"
})

---

Example 4 - Nothing to extract:
Conversation:
Customer: "Okay, sounds good"
Agent: "Great, let me proceed"

→ NO TOOL CALL - no new customer data to extract

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANT RULES:

1. ONLY extract from CUSTOMER messages (not agent responses)
2. ONLY extract information explicitly mentioned
3. Do NOT update fields that are already populated (check CURRENT CONTEXT)
4. Extract ALL relevant fields in ONE call (don't call multiple times)
5. If NO extractable information found, do NOT call the tool

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now analyze the conversation and extract any missing context fields.`;
  }
}

/**
 * Factory function to create DataExtractionAgent
 */
export function createDataExtractionAgent(): DataExtractionAgent {
  return new DataExtractionAgent();
}
