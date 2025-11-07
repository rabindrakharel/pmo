/**
 * Worker MCP Agent
 * Executes MCP tools and updates context with results
 * Responsibilities:
 * - Decide which MCP tool to use based on missing context fields
 * - Call MCP tools/APIs
 * - Interpret MCP results and map to context fields
 * - NO customer-facing responses (handled by WorkerReplyAgent)
 * @module orchestrator/agents/worker-mcp-agent
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { DAGConfiguration, DAGContext } from './dag-types.js';
import type { MCPAdapterService } from '../../mcp-adapter.service.js';
import { getMCPTools } from '../../mcp-adapter.service.js';

/**
 * Worker MCP Agent Result
 */
export interface WorkerMCPResult {
  statusMessage: string; // Optional status to customer
  contextUpdates: Partial<DAGContext>;
  mcpExecuted: boolean;
  mcpResults?: any;
}

/**
 * Worker MCP Agent Service
 * Role: Execute MCP tools and update context (no customer-facing replies)
 */
export class WorkerMCPAgent {
  private dagConfig: DAGConfiguration;
  private mcpAdapter?: MCPAdapterService;
  private authToken?: string;

  constructor(dagConfig: DAGConfiguration, mcpAdapter?: MCPAdapterService, authToken?: string) {
    this.dagConfig = dagConfig;
    this.mcpAdapter = mcpAdapter;
    this.authToken = authToken;
  }

  /**
   * Execute MCP node: Decide which tool to use and execute it
   * OR extract information from conversation (for extraction nodes)
   */
  async executeNode(
    nodeName: string,
    state: AgentContextState
  ): Promise<WorkerMCPResult> {
    console.log(`\n🔧 [WorkerMCPAgent] Executing MCP node: ${nodeName}`);

    // Get node configuration
    const node = this.dagConfig.nodes.find(n => n.node_name === nodeName);
    if (!node) {
      throw new Error(`Node not found in DAG: ${nodeName}`);
    }

    // Check if this is an extraction node (extracts from conversation, no external tools)
    const isExtractionNode = nodeName === 'Extract_Customer_Issue' ||
                             nodeName.toLowerCase().includes('extract');

    if (isExtractionNode) {
      // Handle extraction nodes (analyze conversation, return context updates)
      return await this.executeExtractionNode(nodeName, node, state);
    }

    // Regular MCP nodes (call external tools)
    if (!this.mcpAdapter) {
      console.warn(`[WorkerMCPAgent] ⚠️ MCP adapter not available`);
      return {
        statusMessage: '',
        contextUpdates: {},
        mcpExecuted: false
      };
    }

    // Get available MCP tools
    const availableTools = getMCPTools();
    console.log(`[WorkerMCPAgent] 📋 Available MCP tools: ${availableTools.length}`);

    // Build prompt to decide which tool to use
    const systemPrompt = this.buildMCPSystemPrompt(node, state.context, availableTools);
    const userPrompt = this.buildMCPUserPrompt(state.context);

    console.log(`[WorkerMCPAgent] Analyzing context to decide which MCP tool to use...`);

    // Call LLM with function calling
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      tools: availableTools,
      tool_choice: 'auto',
      sessionId: state.sessionId,
    });

    let mcpResults: any = null;
    let contextUpdates: Partial<DAGContext> = {};

    // Execute MCP tool if LLM decided to use one
    if (result.tool_calls && result.tool_calls.length > 0) {
      console.log(`[WorkerMCPAgent] 🔧 LLM selected ${result.tool_calls.length} MCP tool(s)`);

      for (const toolCall of result.tool_calls) {
        console.log(`[WorkerMCPAgent] Executing: ${toolCall.function.name}`);

        try {
          const { executeMCPTool } = await import('../../mcp-adapter.service.js');
          const toolResult = await executeMCPTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            this.authToken || ''
          );

          mcpResults = toolResult;
          console.log(`[WorkerMCPAgent] ✅ MCP tool executed successfully`);

          // Map tool results to context updates
          const updates = this.mapMCPResultsToContext(toolCall.function.name, toolResult);
          contextUpdates = { ...contextUpdates, ...updates };
        } catch (error: any) {
          console.error(`[WorkerMCPAgent] ❌ MCP tool execution failed: ${error.message}`);
          mcpResults = { error: error.message };
        }
      }
    }

    // Log context updates
    this.logContextUpdates(contextUpdates);

    // Optional status message to customer (brief, if needed)
    const statusMessage = result.content || '';

    return {
      statusMessage,
      contextUpdates,
      mcpExecuted: true,
      mcpResults
    };
  }

  /**
   * Build system prompt for MCP tool selection
   * OPTIMIZED: Uses node.role, node.goal, and ONLY actively tracked context fields
   */
  private buildMCPSystemPrompt(node: any, context: DAGContext, tools: any[]): string {
    // Node provides role and goal (business operation state)
    const nodeRole = node.node_role || node.role || 'a data-gathering system assistant';
    const nodeGoal = node.node_goal || '';
    const exampleTone = node.example_tone_of_reply || '';

    // Format available tools
    const toolSummary = tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');

    // Format ONLY actively tracked context fields (mandatory + non-empty fields)
    const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || ['customers_main_ask', 'customer_phone_number'];
    const activeContext: Record<string, any> = { flags: context.flags || {} };

    for (const field of mandatoryFields) {
      if (context[field]) activeContext[field] = context[field];
    }

    const trackingFields = ['customer_id', 'task_id', 'appointment_details', 'matching_service_catalog_to_solve_customers_issue'];
    for (const field of trackingFields) {
      if (context[field] && context[field] !== '' && context[field] !== '(not set)') {
        activeContext[field] = context[field];
      }
    }

    return `NODE ROLE: ${nodeRole}

NODE GOAL: ${nodeGoal}

EXAMPLE TONE/STYLE (for optional customer message):
${exampleTone}

ACTIVE CONTEXT (only tracked fields):
${JSON.stringify(activeContext, null, 2)}

AVAILABLE MCP TOOLS (${tools.length} tools):
${toolSummary}

TASK:
1. Analyze context to identify missing fields
2. Select appropriate MCP tool from available list
3. Call tool using function calling with parameters from context
4. Optionally provide brief status message to customer

Please call MCP tool or take necessary action:`;
  }

  /**
   * Build user prompt for MCP execution
   */
  private buildMCPUserPrompt(context: DAGContext): string {
    return `Analyze the current context and determine what needs to be fetched:

Context Status:
- customers_main_ask: ${context.customers_main_ask || '(not set)'}
- customer_phone_number: ${context.customer_phone_number || '(not set)'}
- customer_id: ${context.customer_id || '(not set)'}
- service_catalog: ${context.matching_service_catalog_to_solve_customers_issue || '(not set)'}
- task_id: ${context.task_id || '(not set)'}
- appointment_details: ${context.appointment_details || '(not set)'}

Select and call appropriate MCP tool(s) to fetch missing data.`;
  }

  /**
   * Map MCP tool results to context updates
   * Uses heuristics based on tool name patterns
   */
  private mapMCPResultsToContext(toolName: string, results: any): Partial<DAGContext> {
    const updates: Partial<DAGContext> = {};

    console.log(`[WorkerMCPAgent] 📋 Mapping results from: ${toolName}`);

    // Service catalog lookup
    if (toolName.includes('service') || toolName.includes('catalog') || toolName.includes('setting')) {
      if (Array.isArray(results)) {
        updates.matching_service_catalog_to_solve_customers_issue = results[0]?.name || results[0]?.label || JSON.stringify(results);
      } else if (results.name || results.label) {
        updates.matching_service_catalog_to_solve_customers_issue = results.name || results.label;
      }
    }

    // Entity/linkage lookup
    if (toolName.includes('entity') || toolName.includes('entities') || toolName.includes('linkage')) {
      updates.related_entities_for_customers_ask = Array.isArray(results) ? JSON.stringify(results) : JSON.stringify([results]);
    }

    // Task operations
    if (toolName.includes('task')) {
      if (results.id || results.task_id || results.uuid) {
        updates.task_id = results.id || results.task_id || results.uuid;
      }
      if (results.name) {
        updates.task_name = results.name;
      }
    }

    // Appointment/booking operations
    if (toolName.includes('appointment') || toolName.includes('booking') || toolName.includes('calendar')) {
      if (typeof results === 'object' && results !== null) {
        const appointmentStr = results.from_ts && results.to_ts
          ? `Scheduled for ${results.from_ts} - ${results.to_ts}${results.person_entity_id ? ' with ' + results.person_entity_id : ''}`
          : JSON.stringify(results);
        updates.appointment_details = appointmentStr;
      } else {
        updates.appointment_details = typeof results === 'string' ? results : JSON.stringify(results);
      }
    }

    // Customer operations
    if (toolName.includes('customer') || toolName.includes('cust')) {
      if (results.id) {
        updates.customer_id = results.id;
      }
      if (results.name || results.primary_contact_name) {
        updates.customer_name = results.name || results.primary_contact_name;
      }
      if (results.primary_phone) {
        updates.customer_phone_number = results.primary_phone;
      }
      if (results.primary_email) {
        updates.customer_email = results.primary_email;
      }
    }

    // Employee operations
    if (toolName.includes('employee')) {
      if (results.id) {
        updates.assigned_employee_id = results.id;
      }
      if (results.name) {
        updates.assigned_employee_name = results.name;
      }
    }

    // Project operations
    if (toolName.includes('project')) {
      if (results.id) {
        updates.project_id = results.id;
      }
    }

    return updates;
  }

  /**
   * Log context updates
   */
  private logContextUpdates(contextUpdates: Partial<DAGContext>): void {
    const updatedFields = Object.keys(contextUpdates).filter(k => k !== 'flags');
    if (updatedFields.length === 0) {
      console.log(`[WorkerMCPAgent] ℹ️  No context updates from MCP`);
      return;
    }

    console.log(`[WorkerMCPAgent] 📝 Context updates from MCP: ${updatedFields.join(', ')}`);
    for (const field of updatedFields) {
      console.log(`[WorkerMCPAgent]    - ${field}: ${contextUpdates[field]}`);
    }
    console.log(`[WorkerMCPAgent] ℹ️  These updates will be MERGED into existing context`);
  }

  /**
   * Execute extraction node (analyzes conversation, no external tools)
   */
  private async executeExtractionNode(
    nodeName: string,
    node: any,
    state: AgentContextState
  ): Promise<WorkerMCPResult> {
    console.log(`[WorkerMCPAgent] 🔍 Extraction node: ${nodeName}`);

    const systemPrompt = this.buildExtractionSystemPrompt(node, state.context, state);
    const userPrompt = `Extract information from the conversation and return context updates as JSON.`;

    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      jsonMode: true, // Request structured JSON output
      sessionId: state.sessionId,
    });

    let contextUpdates: Partial<DAGContext> = {};

    try {
      // Parse extracted data
      const extracted = JSON.parse(result.content || '{}');
      console.log(`[WorkerMCPAgent] 🔍 Extracted data: ${JSON.stringify(extracted)}`);

      contextUpdates = extracted;

      // Log what was extracted
      this.logContextUpdates(contextUpdates);

      return {
        statusMessage: '', // No customer-facing message for extraction nodes
        contextUpdates,
        mcpExecuted: true,
        mcpResults: extracted
      };
    } catch (error: any) {
      console.error(`[WorkerMCPAgent] ❌ Extraction failed: ${error.message}`);
      return {
        statusMessage: '',
        contextUpdates: {},
        mcpExecuted: false,
        mcpResults: { error: error.message }
      };
    }
  }

  /**
   * Build system prompt for extraction nodes
   * Uses summary_of_conversation_on_each_step_until_now array with fallback to raw messages
   * OPTIMIZED: Only uses last 10 exchanges to avoid token limits
   */
  private buildExtractionSystemPrompt(node: any, context: DAGContext, state: AgentContextState): string {
    const nodeRole = node.role || 'an information extraction specialist';
    const nodeGoal = node.node_goal || '';
    const exampleTone = node.example_tone_of_reply || '';

    // Use summary array if populated, otherwise fallback to raw messages
    let conversationHistory = '';
    const summaryArray = context.summary_of_conversation_on_each_step_until_now || [];

    if (summaryArray.length > 0) {
      // CRITICAL: Only last 10 exchanges (not all 255!) for extraction
      const recentExchanges = summaryArray.slice(-10);
      conversationHistory = recentExchanges
        .map((exchange, idx) => `${idx + 1}. CUSTOMER: ${exchange.customer}\n   AGENT: ${exchange.agent}`)
        .join('\n\n');
      console.log(`[WorkerMCPAgent] 📋 Using last ${recentExchanges.length} conversation exchanges (total: ${summaryArray.length})`);
    } else {
      // Fallback to raw messages if summary not populated yet (limit to last 10)
      const recentMessages = state.messages.slice(-10);
      conversationHistory = recentMessages
        .map((m, idx) => `${idx + 1}. ${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');
      console.log(`[WorkerMCPAgent] ⚠️ Summary array empty, using last ${recentMessages.length} raw messages (total: ${state.messages.length})`);
    }

    // Format current context
    const contextData = JSON.stringify({
      customers_main_ask: context.customers_main_ask || '(not set)',
      customer_name: context.customer_name || '(not set)',
      customer_phone_number: context.customer_phone_number || '(not set)',
    }, null, 2);

    return `You are ${nodeRole}.

Your goal is: ${nodeGoal}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FULL CONVERSATION HISTORY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${conversationHistory}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current context (may be incomplete):
${contextData}

Instructions / Example Tone:
${exampleTone}

CRITICAL EXTRACTION RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Read the ENTIRE conversation history above
2. Extract the customer's main issue/problem from ANY customer message
3. Look for patterns:
   - "pipe broke" → "Broken pipe repair needed"
   - "my lawn is brown" → "Lawn care - brown grass issue"
   - "drywall holes" → "Drywall patching and repair"
4. Extract customer name if mentioned ("my name is X", "I'm X")
5. Extract phone number if mentioned (patterns: 555-1234, (555) 123-4567, etc.)
6. Return ONLY valid JSON with extracted fields
7. If a field is NOT found, use empty string "", NOT "(not set)"

Example output:
{
  "customers_main_ask": "Broken pipe repair needed",
  "customer_name": "",
  "customer_phone_number": ""
}

Extract now (return ONLY JSON):`;
  }

  /**
   * Set auth token for MCP calls
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }
}

/**
 * Create worker MCP agent instance
 */
export function createWorkerMCPAgent(
  dagConfig: DAGConfiguration,
  mcpAdapter?: MCPAdapterService,
  authToken?: string
): WorkerMCPAgent {
  return new WorkerMCPAgent(dagConfig, mcpAdapter, authToken);
}
