/**
 * Worker Agent
 * Executes nodes using detailed prompt engineering with full context
 * Each node from dag.json defines its own prompt template and goal
 * Worker builds context, extracts info, and generates customer responses
 * @module orchestrator/agents/worker-agent
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { DAGConfiguration, DAGContext } from '../langgraph/dag-types.js';
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

    return {
      response,
      contextUpdates,
      extractedInfo,
    };
  }

  /**
   * Build system prompt from node configuration
   * Uses node's prompt_templates from dag.json + full context for detailed prompt engineering
   */
  private buildSystemPrompt(node: any, context: DAGContext): string {
    const agentProfile: any = this.dagConfig.AGENT_PROFILE?.worker_agent || {};
    const llmFramework: any = (this.dagConfig as any).llm_framework_instructions || {};

    return `${llmFramework.architecture || 'Multi-Agent Conversation System'}

YOUR ROLE: ${agentProfile.role || 'Worker Agent - executes node using prompt engineering'}

You are executing a specific node. Each node has its own goal and instructions.

CURRENT NODE: ${node.node_name}
NODE GOAL: ${node.node_goal}

FULL CONTEXT (for prompt engineering):
${JSON.stringify(context, null, 2)}

NODE INSTRUCTIONS (from dag.json):
${node.prompt_templates}

Your Task:
1. Follow node's prompt_templates instructions exactly
2. Use full context to craft appropriate response
3. Extract relevant info from user message
4. Update context fields as needed
5. Generate natural, empathetic customer response

Remember: This is basic prompt engineering using context - not routing decisions.`;
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
   * Extract information from conversation
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

    // Use LLM to extract structured information
    const openaiService = getOpenAIService();

    const extractionPrompt = `Extract relevant information from this customer service conversation:

USER: "${userMessage}"
AGENT: "${agentResponse}"

Current context: ${JSON.stringify(context, null, 2)}

Extract and return a JSON object with any of these fields that you can identify:
- customer_name: Customer's name if mentioned
- customer_phone_number: Phone number if provided
- customers_main_ask: Main issue/request (mandatory field)
- matching_service_catalog_to_solve_customers_issue: Service category that matches their issue
- intent_change: Boolean, true if customer changed their request
- data_update_request: Boolean, true if customer wants to update their data

Return ONLY valid JSON, no other text.`;

    try {
      const result = await openaiService.callAgent({
        agentType: 'worker',
        messages: [
          { role: 'system', content: 'You are a data extraction assistant. Return only valid JSON.' },
          { role: 'user', content: extractionPrompt },
        ],
        temperature: 0.1,
        jsonMode: true,
      });

      const extracted = JSON.parse(result.content || '{}');
      console.log(`[WorkerAgent] 🔍 Extracted: ${JSON.stringify(extracted)}`);
      return extracted;
    } catch (error: any) {
      console.error(`[WorkerAgent] ⚠️ Extraction failed: ${error.message}`);
      return {};
    }
  }

  /**
   * Build context updates based on node execution
   */
  private buildContextUpdates(
    nodeName: string,
    extractedInfo: Record<string, any>,
    currentContext: DAGContext
  ): Partial<DAGContext> {
    const updates: Partial<DAGContext> = { ...extractedInfo };

    // Set flag for completed node
    const nodeFlagMap: Record<string, string> = {
      'GREET_CUSTOMER': 'greet_flag',
      'ASK_CUSTOMER_ABOUT_THEIR_NEED': 'ask_need_flag',
      'Identify_Issue': 'identify_issue_flag',
      'Empathize': 'empathize_flag',
      'Console_Build_Rapport': 'rapport_flag',
      'Try_To_Gather_Customers_Data': 'data_phone_flag',
      'Check_IF_existing_customer': 'check_customer_flag',
      'Plan': 'plan_flag',
      'Communicate_To_Customer_Before_Action': 'communicate_plan_flag',
      'Execute_Plan_Using_MCP': 'execute_flag',
      'Tell_Customers_Execution': 'tell_execution_flag',
      'Goodbye_And_Hangup': 'goodbye_flag',
    };

    const flagName = nodeFlagMap[nodeName];
    if (flagName) {
      updates.flags = {
        ...currentContext.flags,
        [flagName]: 1,
      };
      console.log(`[WorkerAgent] 🏁 Set flag: ${flagName} = 1`);
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
   */
  private buildMCPSystemPrompt(node: any, context: DAGContext, tools: any[]): string {
    const agentProfile: any = this.dagConfig.AGENT_PROFILE?.worker_agent || {};
    const llmFramework: any = (this.dagConfig as any).llm_framework_instructions || {};

    const toolSummary = tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');

    return `${llmFramework.architecture || 'Multi-Agent Conversation System'}

YOUR ROLE: ${agentProfile.role || 'Worker Agent - MCP Tool Executor'}

You are executing the use_mcp_to_get_info node. Your job:
1. Analyze what information is needed from context
2. Decide which MCP tool to call
3. Call the tool with appropriate parameters
4. Generate response to customer

CURRENT CONTEXT:
${JSON.stringify(context, null, 2)}

AVAILABLE MCP TOOLS:
${toolSummary}

NODE INSTRUCTIONS:
${node.prompt_templates}

Your Task:
1. Understand what info is needed (service catalog? entities? task? appointment?)
2. Select the appropriate MCP tool
3. Call it with parameters from context
4. Generate a natural response to the customer

Use function calling to execute MCP tools.`;
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
   */
  private extractContextFromMCPResults(toolName: string, results: any): Partial<DAGContext> {
    const updates: Partial<DAGContext> = {};

    // Map tool results to context fields
    if (toolName.includes('service') || toolName.includes('catalog')) {
      updates.matching_service_catalog_to_solve_customers_issue = results;
    }

    if (toolName.includes('entity') || toolName.includes('entities')) {
      updates.related_entities_for_customers_ask = results;
    }

    if (toolName.includes('task')) {
      updates.task_id = results.id || results.task_id;
    }

    if (toolName.includes('appointment') || toolName.includes('booking')) {
      updates.appointment_details = results;
    }

    console.log(`[WorkerAgent] 📝 Extracted context updates from ${toolName}: ${Object.keys(updates).join(', ')}`);
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
