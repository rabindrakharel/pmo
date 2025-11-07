/**
 * Worker Agent
 * Executes nodes using detailed prompt engineering with full context
 * Each node from dag.json defines its own prompt template and goal
 * Worker builds context, extracts info, and generates customer responses
 * @module orchestrator/agents/worker-agent
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { DAGConfiguration, DAGContext } from './dag-types.js';
import type { MCPAdapterService } from '../../mcp-adapter.service.js';
import { getMCPTools } from '../../mcp-adapter.service.js';

/**
 * Worker Agent Result
 */
export interface WorkerAgentResult {
  response: string;
  contextUpdates: Partial<DAGContext>;
  extractedInfo: Record<string, any>;
  mcpExecuted?: boolean;
  mcpResults?: any;
}

/**
 * Worker Agent Service
 * Role: Replies to prompts and performs basic inference to build context
 * For use_mcp_to_get_info node: decides which MCP tool to use and executes it
 */
export class WorkerAgent {
  private dagConfig: DAGConfiguration;
  private mcpAdapter?: MCPAdapterService;
  private authToken?: string;

  constructor(dagConfig: DAGConfiguration, mcpAdapter?: MCPAdapterService, authToken?: string) {
    this.dagConfig = dagConfig;
    this.mcpAdapter = mcpAdapter;
    this.authToken = authToken;
  }

  /**
   * Execute node: detailed prompt engineering using node config from dag.json
   * This is where the "node thing" happens - using context for prompt engineering
   * Navigator decides WHICH node, Worker executes WHAT the node does
   *
   * Special handling for use_mcp_to_get_info: exposes MCP manifest and executes tools
   */
  async executeNode(
    nodeName: string,
    state: AgentContextState,
    userMessage?: string
  ): Promise<WorkerAgentResult> {
    console.log(`\n🔧 [WorkerAgent] Executing node: ${nodeName}`);

    // Get node configuration from dag.json (prompt_templates, node_goal, context_update)
    const node = this.dagConfig.nodes.find(n => n.node_name === nodeName);
    if (!node) {
      throw new Error(`Node not found in DAG: ${nodeName}`);
    }

    // Special handling for MCP node
    if (nodeName === 'use_mcp_to_get_info') {
      return this.executeMCPNode(node, state, userMessage);
    }

    // Build detailed prompt using node's prompt_templates + full context
    const systemPrompt = this.buildSystemPrompt(node, state.context);
    const userPrompt = this.buildUserPrompt(node, state.context, userMessage);

    console.log(`[WorkerAgent] Node Goal: ${node.node_goal}`);

    // Call LLM with node prompt
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const response = result.content || '';

    // Extract information from response and user message
    const extractedInfo = await this.extractInformation(
      nodeName,
      userMessage || '',
      response,
      state.context
    );

    // Build context updates
    const contextUpdates = this.buildContextUpdates(nodeName, extractedInfo, state.context);

    console.log(`[WorkerAgent] ✅ Generated response (${response.length} chars)`);
    console.log(`[WorkerAgent] 📝 Extracted info keys: ${Object.keys(extractedInfo).join(', ')}`);

    // Log context contributions
    const contextKeys = Object.keys(contextUpdates).filter(k => k !== 'flags');
    if (contextKeys.length > 0) {
      console.log(`[WorkerAgent] 📦 Context contributions: ${contextKeys.join(', ')}`);

      // Show new values for mandatory fields
      const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || [];
      for (const field of mandatoryFields) {
        if (contextUpdates[field]) {
          const isNew = !state.context[field] || state.context[field] === '';
          console.log(`[WorkerAgent]    ${isNew ? '❓' : '📞'} ${field} (MANDATORY): ${contextUpdates[field]} ${isNew ? '[NEW]' : '[UPDATED]'}`);
        }
      }
    }

    return {
      response,
      contextUpdates,
      extractedInfo,
    };
  }

  /**
   * Build system prompt from node configuration
   * Uses node's prompt_templates from dag.json + full context for detailed prompt engineering
   * EXPLICITLY tells LLM which context fields THIS node must build (from context_update)
   */
  private buildSystemPrompt(node: any, context: DAGContext): string {
    const agentProfile: any = this.dagConfig.AGENT_PROFILE?.worker_agent || {};
    const llmFramework: any = (this.dagConfig as any).llm_framework_instructions || {};

    // Parse which fields this node should build
    const expectedFields = this.parseExpectedContextFields(node);
    const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || [];

    return `${llmFramework.architecture || 'Multi-Agent Conversation System'}

YOUR ROLE: ${agentProfile.role || 'Worker Agent - executes node using prompt engineering'}

You are executing a specific node. Each node has its own goal and context-building responsibilities.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT NODE: ${node.node_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NODE ROLE: ${node.node_role || 'Context builder and customer responder'}

NODE GOAL:
${node.node_goal}

THIS NODE MUST BUILD THESE CONTEXT FIELDS:
${expectedFields.map(f => `  - ${f}${mandatoryFields.includes(f) ? ' (MANDATORY)' : ''}`).join('\n')}

CURRENT CONTEXT STATE (ONLY actively tracked fields):
${JSON.stringify(this.getActiveContextFields(context, expectedFields), null, 2)}

NODE INSTRUCTIONS EXAMPLE (abbreviated):
${node.prompt_templates ? node.prompt_templates.substring(0, 300) + '...' : 'Follow node goal above'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK (TWO-PART):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART 1 - CUSTOMER RESPONSE (visible to customer):
1. Follow node's prompt_templates instructions exactly
2. Generate natural, empathetic customer response
3. DO NOT mention technical details (context, flags, MCP, etc.)

PART 2 - CONTEXT BUILDING (behind the scenes):
1. Extract/build the context fields THIS node is responsible for
2. Ensure mandatory fields (${mandatoryFields.join(', ')}) are populated if possible
3. If MCP data is needed, indicate what should be fetched (e.g., service catalog, entities)
4. Update flags as specified in context_update

CRITICAL INSTRUCTIONS:
- The "Behind the scenes" instructions in prompt_templates tell you WHAT context to build
- Your extraction will be processed separately to update the context JSON
- Focus on building the fields listed in "THIS NODE MUST BUILD THESE CONTEXT FIELDS" above
- For MCP-related fields, extract what you CAN from the conversation (don't make up data)
- The system will route to use_mcp_to_get_info node if MCP calls are needed

Generate your response now (PART 1 - customer-facing only):`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(node: any, context: DAGContext, userMessage?: string): string {
    let prompt = `You are executing the "${node.node_name}" node.

CURRENT CONTEXT STATE:
${JSON.stringify({
  flags: context.flags,
  customers_main_ask: context.customers_main_ask || '(not set)',
  customer_phone_number: context.customer_phone_number || '(not set)',
  customer_name: context.customer_name || '(not set)',
  service_catalog: context.matching_service_catalog_to_solve_customers_issue || '(not set)',
}, null, 2)}
`;

    if (userMessage) {
      prompt += `\n\nUSER MESSAGE: "${userMessage}"\n`;
    }

    prompt += `\nYour task:
1. ${node.node_goal}
2. Extract any relevant information from the user's message
3. Generate an appropriate response to the customer
4. Indicate what context fields should be updated

Generate your response now:`;

    return prompt;
  }

  /**
   * Get only actively tracked context fields (non-empty, relevant to current node)
   * Reduces token usage by filtering out empty/default values
   */
  private getActiveContextFields(context: DAGContext, expectedFields: string[]): Record<string, any> {
    const activeContext: Record<string, any> = {
      flags: context.flags || {}
    };

    // Always include mandatory fields
    const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || [];
    for (const field of mandatoryFields) {
      if (context[field]) {
        activeContext[field] = context[field];
      }
    }

    // Include expected fields that have values
    for (const field of expectedFields) {
      if (context[field] && context[field] !== '' && context[field] !== '(not set)' && !activeContext[field]) {
        activeContext[field] = context[field];
      }
    }

    return activeContext;
  }

  /**
   * Parse expected context fields from node configuration
   * Reads from node.expected_context_fields in dag.json if present
   */
  private parseExpectedContextFields(node: any): string[] {
    // First check if node has explicit expected_context_fields in dag.json
    if (node.expected_context_fields && Array.isArray(node.expected_context_fields)) {
      console.log(`[WorkerAgent] 📋 Using explicit expected_context_fields from dag.json for ${node.node_name}`);

      // Always include mandatory fields
      const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || [];
      const allFields = [...new Set([...node.expected_context_fields, ...mandatoryFields])];
      return allFields;
    }

    // Fallback: parse from context_update text (legacy behavior)
    console.log(`[WorkerAgent] ⚠️ No expected_context_fields in dag.json for ${node.node_name}, parsing from context_update`);
    const contextUpdate = node.context_update || '';
    const globalSchema = this.dagConfig.global_context_schema?.core_keys || {};

    // Extract field names mentioned in context_update
    const mentionedFields: string[] = [];

    // Check each field from global schema if it's mentioned in this node's context_update
    for (const fieldName of Object.keys(globalSchema)) {
      if (contextUpdate.includes(fieldName)) {
        mentionedFields.push(fieldName);
      }
    }

    // Always include mandatory fields
    const mandatoryFields = this.dagConfig.graph_config?.mandatory_fields || [];
    for (const field of mandatoryFields) {
      if (!mentionedFields.includes(field)) {
        mentionedFields.push(field);
      }
    }

    return mentionedFields;
  }

  /**
   * Build field extraction schema based on node's responsibilities
   */
  private buildFieldExtractionSchema(expectedFields: string[]): string {
    const globalSchema = this.dagConfig.global_context_schema?.core_keys || {};

    const fieldDescriptions = expectedFields
      .map(field => {
        const description = globalSchema[field] || `string (${field})`;
        return `- ${field}: ${description}`;
      })
      .join('\n');

    return fieldDescriptions;
  }

  /**
   * Extract information from conversation - DETERMINISTIC based on node's context_update
   */
  private async extractInformation(
    nodeName: string,
    userMessage: string,
    agentResponse: string,
    context: DAGContext
  ): Promise<Record<string, any>> {
    if (!userMessage) {
      return {};
    }

    // Get node configuration to understand what fields THIS node should build
    const node = this.dagConfig.nodes.find(n => n.node_name === nodeName);
    if (!node) {
      console.warn(`[WorkerAgent] ⚠️ Node ${nodeName} not found in DAG`);
      return {};
    }

    // Parse expected fields from node's context_update
    const expectedFields = this.parseExpectedContextFields(node);
    const fieldSchema = this.buildFieldExtractionSchema(expectedFields);

    console.log(`[WorkerAgent] 📋 Node ${nodeName} should build: [${expectedFields.join(', ')}]`);

    // Use LLM to extract structured information
    const openaiService = getOpenAIService();

    const extractionPrompt = `Extract relevant information from this customer service conversation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NODE CONTEXT BUILDING RESPONSIBILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NODE: ${nodeName}
NODE RESPONSIBILITY (from dag.json): ${node.context_update}

CONVERSATION:
USER: "${userMessage}"
AGENT: "${agentResponse}"

CURRENT CONTEXT:
${JSON.stringify(context, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACT THESE FIELDS (based on node's responsibility):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${fieldSchema}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ONLY extract fields that THIS node is responsible for building (see NODE RESPONSIBILITY above)
2. If a field is already populated in context and hasn't changed, do NOT include it
3. Mandatory fields (customers_main_ask, customer_phone_number) should ALWAYS be extracted if present in user message
4. For MCP-related fields (service_catalog, entities, task_id, appointment_details):
   - Extract only what you can determine from the conversation
   - Do NOT make up data
   - If MCP is needed, the system will route to use_mcp_to_get_info node
5. The "Behind the scenes" instructions from prompt_templates guide what to extract

ADDITIONAL META-FIELDS (always include if detected):
- intent_change: Boolean, true if customer changed their request/issue
- data_update_request: Boolean, true if customer wants to update their personal data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT: Return ONLY valid JSON with the extracted fields, no other text.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    try {
      const result = await openaiService.callAgent({
        agentType: 'worker',
        messages: [
          { role: 'system', content: 'You are a data extraction assistant. Return only valid JSON based on the node\'s specific responsibilities from dag.json.' },
          { role: 'user', content: extractionPrompt },
        ],
        temperature: 0.1,
        jsonMode: true,
      });

      const extracted = JSON.parse(result.content || '{}');

      // Log what was extracted vs what was expected
      const extractedKeys = Object.keys(extracted);
      const unexpectedKeys = extractedKeys.filter(k => !expectedFields.includes(k) && k !== 'intent_change' && k !== 'data_update_request');

      console.log(`[WorkerAgent] 🔍 Extracted: ${JSON.stringify(extracted)}`);
      if (unexpectedKeys.length > 0) {
        console.log(`[WorkerAgent] ⚠️ Unexpected fields extracted (not in node's context_update): [${unexpectedKeys.join(', ')}]`);
      }

      return extracted;
    } catch (error: any) {
      console.error(`[WorkerAgent] ⚠️ Extraction failed: ${error.message}`);
      return {};
    }
  }

  /**
   * Build context updates based on node execution
   * Reads flag mapping from dag.json routing_config.node_flag_mapping
   */
  private buildContextUpdates(
    nodeName: string,
    extractedInfo: Record<string, any>,
    currentContext: DAGContext
  ): Partial<DAGContext> {
    const updates: Partial<DAGContext> = { ...extractedInfo };

    // Read flag mapping from dag.json instead of hardcoding
    const nodeFlagMapping = (this.dagConfig.routing_config as any)?.node_flag_mapping?.mappings || {};
    const flagName = nodeFlagMapping[nodeName];

    if (flagName) {
      updates.flags = {
        ...currentContext.flags,
        [flagName]: 1,
      };
      console.log(`[WorkerAgent] 🏁 Set flag: ${flagName} = 1 (from dag.json)`);
    }

    // Handle specific data flags
    if (extractedInfo.customer_phone_number) {
      updates.flags = {
        ...updates.flags,
        data_phone_flag: 1,
      };
    }
    if (extractedInfo.customer_name) {
      updates.flags = {
        ...updates.flags,
        data_name_flag: 1,
      };
    }

    return updates;
  }

  /**
   * Execute MCP node: Worker decides which MCP tool to use and executes it
   */
  private async executeMCPNode(
    node: any,
    state: AgentContextState,
    userMessage?: string
  ): Promise<WorkerAgentResult> {
    console.log(`[WorkerAgent] 🔧 Executing MCP node`);

    if (!this.mcpAdapter) {
      console.warn(`[WorkerAgent] ⚠️ MCP adapter not available - skipping tool execution`);
      return {
        response: 'I need to fetch some information, but the system is not configured for that right now.',
        contextUpdates: {},
        extractedInfo: {},
        mcpExecuted: false
      };
    }

    // Get available MCP tools
    const availableTools = getMCPTools();
    console.log(`[WorkerAgent] 📋 Available MCP tools: ${availableTools.length}`);

    // Build prompt with MCP manifest
    const systemPrompt = this.buildMCPSystemPrompt(node, state.context, availableTools);
    const userPrompt = this.buildMCPUserPrompt(state.context, userMessage);

    console.log(`[WorkerAgent] Asking LLM to decide which MCP tool to use...`);

    // Call LLM with function calling to decide which MCP tool to use
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      tools: availableTools,
      tool_choice: 'auto'
    });

    let mcpResults: any = null;
    let contextUpdates: Partial<DAGContext> = {};

    // Execute MCP tool if LLM decided to use one
    if (result.tool_calls && result.tool_calls.length > 0) {
      console.log(`[WorkerAgent] 🔧 LLM selected ${result.tool_calls.length} MCP tool(s)`);

      for (const toolCall of result.tool_calls) {
        console.log(`[WorkerAgent] Executing MCP tool: ${toolCall.function.name}`);

        try {
          // Import executeMCPTool function
          const { executeMCPTool } = await import('../../mcp-adapter.service.js');

          const toolResult = await executeMCPTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            this.authToken || ''
          );

          mcpResults = toolResult;
          console.log(`[WorkerAgent] ✅ MCP tool executed successfully`);

          // Update context based on tool results
          contextUpdates = this.extractContextFromMCPResults(toolCall.function.name, toolResult);
        } catch (error: any) {
          console.error(`[WorkerAgent] ❌ MCP tool execution failed: ${error.message}`);
          mcpResults = { error: error.message };
        }
      }
    }

    // Generate response to customer
    const response = result.content || 'Let me check that information for you...';

    return {
      response,
      contextUpdates,
      extractedInfo: {},
      mcpExecuted: true,
      mcpResults
    };
  }

  /**
   * Build system prompt for MCP node with available tools
   * This node is responsible for fetching external data via MCP
   */
  private buildMCPSystemPrompt(node: any, context: DAGContext, tools: any[]): string {
    const agentProfile: any = this.dagConfig.AGENT_PROFILE?.worker_agent || {};
    const llmFramework: any = (this.dagConfig as any).llm_framework_instructions || {};

    const toolSummary = tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');

    // Parse which fields this node should build
    const expectedFields = this.parseExpectedContextFields(node);

    return `${llmFramework.architecture || 'Multi-Agent Conversation System'}

YOUR ROLE: ${agentProfile.role || 'Worker Agent - MCP Tool Executor'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT NODE: ${node.node_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NODE ROLE: ${node.node_role || 'MCP tool executor and data fetcher'}

NODE GOAL:
${node.node_goal}

THIS NODE MUST BUILD THESE CONTEXT FIELDS:
${expectedFields.map(f => `  - ${f}`).join('\n')}

CURRENT CONTEXT STATE (ONLY actively tracked fields):
${JSON.stringify(this.getActiveContextFields(context, expectedFields), null, 2)}

AVAILABLE MCP TOOLS (${tools.length} tools):
${toolSummary}

NODE INSTRUCTIONS EXAMPLE (abbreviated):
${node.prompt_templates ? node.prompt_templates.substring(0, 300) + '...' : 'Use MCP tools to fetch missing data'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ANALYZE CONTEXT: Determine what information is missing or needed:
   - matching_service_catalog_to_solve_customers_issue (needs service catalog data)
   - related_entities_for_customers_ask (needs entity data)
   - task_id (needs task creation/lookup)
   - appointment_details (needs appointment data)

2. SELECT MCP TOOL(S): Based on what's needed, select appropriate tool(s) from the list above

3. CALL TOOL(S): Use function calling to execute MCP tools with parameters from context

4. GENERATE RESPONSE: Provide a natural, empathetic response to customer (optional, only if interaction needed)

IMPORTANT:
- Use the "Behind the scenes" instructions from prompt_templates as guidance
- The MCP tool results will automatically update the context
- Focus on fetching the fields THIS node is responsible for building
- Use function calling (tools) to execute MCP calls

Execute MCP tools now based on context analysis:`;
  }

  /**
   * Build user prompt for MCP node
   */
  private buildMCPUserPrompt(context: DAGContext, userMessage?: string): string {
    return `Based on the current context, determine what information needs to be fetched:

Context Analysis:
- customers_main_ask: ${context.customers_main_ask || '(not set)'}
- service_catalog: ${context.matching_service_catalog_to_solve_customers_issue || '(not set)'}
- task_id: ${context.task_id || '(not set)'}
- appointment_details: ${context.appointment_details || '(not set)'}

What needs to be fetched? Select and call the appropriate MCP tool.`;
  }

  /**
   * Extract context updates from MCP tool results
   * IMPORTANT: This returns PARTIAL updates that will be MERGED (not replaced)
   *
   * MCP tools are defined in the MCP manifest (apps/mcp-server/src/api-manifest.ts)
   * This method uses heuristics based on tool name patterns to map results to context fields
   */
  private extractContextFromMCPResults(toolName: string, results: any): Partial<DAGContext> {
    const updates: Partial<DAGContext> = {};

    // Use heuristics based on tool name patterns to map MCP results to context fields
    // These match the tools defined in the MCP manifest
    console.log(`[WorkerAgent] 📋 Extracting context from MCP tool: ${toolName}`);

    // Service catalog lookup (setting_list with service category)
    if (toolName.includes('service') || toolName.includes('catalog') || toolName.includes('setting')) {
      if (Array.isArray(results)) {
        // If results is an array of services, use first one or let LLM decide
        updates.matching_service_catalog_to_solve_customers_issue = results[0]?.name || results[0]?.label || JSON.stringify(results);
      } else if (results.name || results.label) {
        updates.matching_service_catalog_to_solve_customers_issue = results.name || results.label;
      }
    }

    // Related entities lookup
    if (toolName.includes('entity') || toolName.includes('entities') || toolName.includes('linkage')) {
      updates.related_entities_for_customers_ask = Array.isArray(results) ? JSON.stringify(results) : JSON.stringify([results]);
    }

    // Task operations (task_create, task_get, task_list)
    if (toolName.includes('task')) {
      if (results.id || results.task_id || results.uuid) {
        updates.task_id = results.id || results.task_id || results.uuid;
      }
      // Also capture task details if available
      if (results.name) {
        updates.task_name = results.name;
      }
    }

    // Appointment/booking operations (person_calendar_book, booking_create)
    if (toolName.includes('appointment') || toolName.includes('booking') || toolName.includes('calendar')) {
      if (typeof results === 'object' && results !== null) {
        // Format appointment details as readable string
        const appointmentStr = results.from_ts && results.to_ts
          ? `Scheduled for ${results.from_ts} - ${results.to_ts}${results.person_entity_id ? ' with ' + results.person_entity_id : ''}`
          : JSON.stringify(results);
        updates.appointment_details = appointmentStr;
      } else {
        updates.appointment_details = typeof results === 'string' ? results : JSON.stringify(results);
      }
    }

    // Customer operations (customer_create, customer_get, customer_list)
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

    // Employee operations (for assignment)
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

    console.log(`[WorkerAgent] 📝 Extracted context updates from ${toolName}: ${Object.keys(updates).join(', ')}`);
    console.log(`[WorkerAgent]    ℹ️  These updates will be MERGED (not replaced) into existing context`);
    return updates;
  }

  /**
   * Set auth token for MCP calls
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }
}

/**
 * Create worker agent instance
 */
export function createWorkerAgent(
  dagConfig: DAGConfiguration,
  mcpAdapter?: MCPAdapterService,
  authToken?: string
): WorkerAgent {
  return new WorkerAgent(dagConfig, mcpAdapter, authToken);
}
