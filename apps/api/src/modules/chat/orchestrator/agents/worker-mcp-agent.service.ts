/**
 * Worker MCP Agent - Goal-Oriented with ReAct Pattern
 *
 * Responsibilities:
 * - Observe: Identify what data is missing from context
 * - Think: Decide which MCP tool can retrieve that data
 * - Act: Execute MCP tool and map results to context
 * - Uses agent profile for consistent tool selection strategy
 *
 * @module orchestrator/agents/worker-mcp-agent
 * @version 3.0.0
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { AgentConfigV3, ConversationGoal, AgentProfile } from '../config/agent-config.schema.js';
import type { MCPAdapterService } from '../../mcp-adapter.service.js';
import { getMCPTools } from '../../mcp-adapter.service.js';
import type { DAGContext } from './dag-types.js';

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
 * Uses ReAct pattern to select and execute appropriate MCP tools
 */
export class WorkerMCPAgent {
  private config: AgentConfigV3;
  private agentProfile: AgentProfile;
  private mcpAdapter?: MCPAdapterService;
  private authToken?: string;

  constructor(
    config: AgentConfigV3,
    mcpAdapter?: MCPAdapterService,
    authToken?: string,
    agentProfileId: string = 'mcp_agent'
  ) {
    this.config = config;
    this.mcpAdapter = mcpAdapter;
    this.authToken = authToken;

    // Get agent profile from config
    const profile = config.agent_profiles[agentProfileId];
    if (!profile) {
      throw new Error(`Agent profile not found: ${agentProfileId}`);
    }
    this.agentProfile = profile;

    console.log(`[WorkerMCPAgent] 🎭 Initialized with profile: ${this.agentProfile.identity}`);
  }

  /**
   * Execute goal: Use MCP tools to fetch/update data
   *
   * ReAct Steps:
   * 1. OBSERVE: Identify what data is missing based on goal success criteria
   * 2. THINK: Determine which MCP tool can retrieve needed data
   * 3. ACT: Execute MCP tool and map results to context
   */
  async executeGoal(
    goalId: string,
    state: AgentContextState
  ): Promise<WorkerMCPResult> {
    console.log(`\n🔧 [WorkerMCPAgent] Executing goal: ${goalId}`);

    // Get goal configuration
    const goal = this.config.goals.find(g => g.goal_id === goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    if (!this.mcpAdapter) {
      console.warn(`[WorkerMCPAgent] ⚠️ MCP adapter not available`);
      return {
        statusMessage: '',
        contextUpdates: {},
        mcpExecuted: false
      };
    }

    // OBSERVE: Analyze what's missing
    const observation = this.observe(goal, state);

    // Get available MCP tools
    const availableTools = getMCPTools();
    console.log(`[WorkerMCPAgent] 📋 Available MCP tools: ${availableTools.length}`);

    // THINK + ACT: Select and execute tool
    const systemPrompt = this.buildReActPrompt(goal, observation, availableTools);
    const userPrompt = this.buildUserPrompt(observation);

    console.log(`[WorkerMCPAgent] Goal: ${goal.description}`);
    console.log(`[WorkerMCPAgent] Agent Identity: ${this.agentProfile.identity}`);
    console.log(`[WorkerMCPAgent] Analyzing context to decide which MCP tool to use...`);

    // Call LLM with function calling
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'worker_mcp',
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

          // Parse arguments and enrich them with context data
          let toolArgs = JSON.parse(toolCall.function.arguments);
          toolArgs = this.enrichMCPToolArguments(toolCall.function.name, toolArgs, state);

          const toolResult = await executeMCPTool(
            toolCall.function.name,
            toolArgs,
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
   * OBSERVE: Identify what data is missing based on goal
   */
  private observe(goal: ConversationGoal, state: AgentContextState) {
    // Success criteria tells us what fields we need
    const successCriteria = goal.success_criteria;
    const mandatoryFields = successCriteria.mandatory_fields;

    // Check which fields are missing or empty
    const missingFields: string[] = [];
    const presentFields: Record<string, any> = {};

    for (const field of mandatoryFields) {
      const value = this.getFieldValue(state.context, field);
      if (!value || value === '' || value === '(not set)') {
        missingFields.push(field);
      } else {
        presentFields[field] = value;
      }
    }

    // Current context data
    const contextData = {
      customer: {
        name: state.context.data_extraction_fields?.customer_name || '(unknown)',
        phone: state.context.data_extraction_fields?.customer_phone_number || '(unknown)',
        id: state.context.data_extraction_fields?.customer_id || '(unknown)',
      },
      service: {
        request: state.context.data_extraction_fields?.customers_main_ask || '(not stated)',
        matching_catalog: state.context.data_extraction_fields?.matching_service_catalog_to_solve_customers_issue || '(not matched)',
      },
      operations: {
        task_id: state.context.data_extraction_fields?.task_id || '(not created)',
        appointment: state.context.data_extraction_fields?.appointment_details || '(not scheduled)',
      },
      next_action: state.context.next_course_of_action || '(no guidance)',
    };

    return {
      missingFields,
      presentFields,
      contextData,
      goalDescription: goal.description,
    };
  }

  /**
   * Get field value from context (supports nested paths like service.primary_request)
   */
  private getFieldValue(context: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value = context;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined || value === null) break;
    }
    return value;
  }

  /**
   * BUILD REACT PROMPT: Uses agent profile and goal configuration
   */
  private buildReActPrompt(goal: ConversationGoal, observation: any, tools: any[]): string {
    // Format available tools
    const toolSummary = tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');

    return `# AGENT IDENTITY
${this.agentProfile.system_prompt}

# CURRENT GOAL
**Objective:** ${goal.description}

**What We Need (Success Criteria):**
${goal.success_criteria.mandatory_fields.map(f => `- ${f}`).join('\n')}

# REACT: OBSERVE → THINK → ACT

## 1. OBSERVE (Current Data Status)

**Missing Fields (need to fetch):**
${observation.missingFields.length > 0 ? observation.missingFields.map((f: string) => `- ${f}`).join('\n') : '(none - all required fields present)'}

**Present Fields (already have):**
\`\`\`json
${JSON.stringify(observation.presentFields, null, 2)}
\`\`\`

**Current Context:**
\`\`\`json
${JSON.stringify(observation.contextData, null, 2)}
\`\`\`

**Guidance from System:** ${observation.contextData.next_action}

## 2. THINK (Tool Selection)

**Available MCP Tools (${tools.length} tools):**
${toolSummary}

Based on observations:
- Which fields are missing that we need for goal: "${observation.goalDescription}"?
- Which MCP tool can retrieve the missing data?
- What parameters does the tool need from current context?

## 3. ACT (Execute Tool)

**Instructions:**
- Select appropriate MCP tool from available list
- Call tool using function calling with parameters from present fields
- If no tool needed (all fields present), return brief status message
- Keep any customer message brief and informative

Execute MCP tool now or provide status:`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(observation: any): string {
    if (observation.missingFields.length === 0) {
      return `All required fields are present. No MCP tool execution needed. Provide brief status if appropriate.`;
    }

    return `Missing fields: ${observation.missingFields.join(', ')}

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
   * Enrich MCP tool arguments with session context data
   * Adds extracted data + conversation history to task descriptions
   * Adds task references + attendees to calendar bookings
   */
  private enrichMCPToolArguments(
    toolName: string,
    args: Record<string, any>,
    state: AgentContextState
  ): Record<string, any> {
    console.log(`[WorkerMCPAgent] 🔍 Enriching arguments for tool: ${toolName}`);

    // Enrich task_create with extracted data + conversation history
    if (toolName === 'task_create') {
      console.log(`[WorkerMCPAgent] 📋 Enriching task description with extracted data + conversation`);

      const extracted = state.context.data_extraction_fields || {};
      const conversations = state.context.summary_of_conversation_on_each_step_until_now || [];

      // Build rich description
      let richDescription = args.body_descr || '';

      // Add extracted customer data
      if (extracted.customer) {
        richDescription += '\n\n## Customer Information\n';
        if (extracted.customer.name) richDescription += `- Name: ${extracted.customer.name}\n`;
        if (extracted.customer.phone) richDescription += `- Phone: ${extracted.customer.phone}\n`;
        if (extracted.customer.email) richDescription += `- Email: ${extracted.customer.email}\n`;

        // Fine-grained address fields
        const addressParts: string[] = [];
        if (extracted.customer.address_street) addressParts.push(extracted.customer.address_street);
        if (extracted.customer.address_city) addressParts.push(extracted.customer.address_city);
        if (extracted.customer.address_state) addressParts.push(extracted.customer.address_state);
        if (extracted.customer.address_zipcode) addressParts.push(extracted.customer.address_zipcode);
        if (extracted.customer.address_country) addressParts.push(extracted.customer.address_country);

        if (addressParts.length > 0) {
          richDescription += `- Address: ${addressParts.join(', ')}\n`;
        }
      }

      // Add service request details
      if (extracted.service) {
        richDescription += '\n## Service Request\n';
        if (extracted.service.primary_request) {
          richDescription += `- Request: ${extracted.service.primary_request}\n`;
        }
        if (extracted.service.catalog_match) {
          richDescription += `- Service Type: ${extracted.service.catalog_match}\n`;
        }
      }

      // Add conversation history
      if (conversations.length > 0) {
        richDescription += '\n## Conversation History\n';
        conversations.forEach((exchange: any, index: number) => {
          richDescription += `\n**Exchange ${index + 1}:**\n`;
          richDescription += `Customer: ${exchange.customer}\n`;
          richDescription += `Agent: ${exchange.agent}\n`;
        });
      }

      args.body_descr = richDescription.trim();
      console.log(`[WorkerMCPAgent] ✅ Enhanced task description (${richDescription.length} chars)`);
    }

    // Enrich person_calendar_book with task reference + attendees
    if (toolName === 'person_calendar_book') {
      console.log(`[WorkerMCPAgent] 📅 Enriching calendar event with task details + attendees`);

      const extracted = state.context.data_extraction_fields || {};

      // Build event title if not provided
      if (!args.body_title && extracted.service?.primary_request) {
        args.body_title = `Service: ${extracted.service.primary_request}`;
      }

      // Build event instructions/details
      let eventInstructions = args.body_instructions || '';

      // Add task reference if available
      if (extracted.operations?.task_id) {
        eventInstructions += `\n\nTask ID: ${extracted.operations.task_id}`;
        if (extracted.operations.task_name) {
          eventInstructions += `\nTask: ${extracted.operations.task_name}`;
        }
      }

      // Add service details
      if (extracted.service?.primary_request) {
        eventInstructions += `\n\nService: ${extracted.service.primary_request}`;
      }

      // Add customer info
      if (extracted.customer?.name) {
        eventInstructions += `\n\nCustomer: ${extracted.customer.name}`;
        if (extracted.customer.phone) {
          eventInstructions += `\nPhone: ${extracted.customer.phone}`;
        }
      }

      args.body_instructions = eventInstructions.trim();

      // Build attendees list for metadata
      const attendees: Array<{ name: string; email?: string; phone?: string; type: string }> = [];

      // Add customer as attendee
      if (extracted.customer?.name) {
        attendees.push({
          name: extracted.customer.name,
          email: extracted.customer.email || undefined,
          phone: extracted.customer.phone || undefined,
          type: 'customer'
        });
      }

      // Add employee as attendee
      if (extracted.assignment?.employee_name) {
        attendees.push({
          name: extracted.assignment.employee_name,
          email: undefined, // Will need to fetch from employee record
          type: 'employee'
        });
      }

      // Merge attendees into metadata
      const existingMetadata = args.body_metadata ? JSON.parse(args.body_metadata) : {};
      const enrichedMetadata = {
        ...existingMetadata,
        attendees,
        task_id: extracted.operations?.task_id,
        service_type: extracted.service?.catalog_match
      };

      args.body_metadata = JSON.stringify(enrichedMetadata);

      console.log(`[WorkerMCPAgent] ✅ Enhanced calendar event with ${attendees.length} attendees`);
    }

    // Enrich customer_create with fine-grained address
    if (toolName === 'customer_create') {
      console.log(`[WorkerMCPAgent] 👤 Enriching customer_create with fine-grained address`);

      const extracted = state.context.data_extraction_fields || {};

      // Map extracted customer data to API fields
      if (extracted.customer) {
        if (extracted.customer.name && !args.body_name) {
          args.body_name = extracted.customer.name;
        }
        if (extracted.customer.phone && !args.body_primary_phone) {
          args.body_primary_phone = extracted.customer.phone;
        }
        if (extracted.customer.email && !args.body_primary_email) {
          args.body_primary_email = extracted.customer.email;
        }

        // Fine-grained address mapping
        // Combine address components into primary_address field for customer table
        const addressParts: string[] = [];
        if (extracted.customer.address_street) {
          addressParts.push(extracted.customer.address_street);
          args.body_primary_address = extracted.customer.address_street; // Street goes to primary_address
        }
        if (extracted.customer.address_city && !args.body_city) {
          args.body_city = extracted.customer.address_city;
        }
        if (extracted.customer.address_state && !args.body_province) {
          args.body_province = extracted.customer.address_state;
        }
        if (extracted.customer.address_zipcode && !args.body_postal_code) {
          args.body_postal_code = extracted.customer.address_zipcode;
        }
        if (extracted.customer.address_country && !args.body_country) {
          args.body_country = extracted.customer.address_country;
        }

        console.log(`[WorkerMCPAgent] ✅ Mapped customer data with fine-grained address`);
      }
    }

    // Enrich customer_update with fine-grained address
    if (toolName === 'customer_update') {
      console.log(`[WorkerMCPAgent] 👤 Enriching customer_update with fine-grained address`);

      const extracted = state.context.data_extraction_fields || {};

      // Map extracted customer data to API fields (incremental update)
      if (extracted.customer) {
        if (extracted.customer.name && !args.body_name) {
          args.body_name = extracted.customer.name;
        }
        if (extracted.customer.phone && !args.body_primary_phone) {
          args.body_primary_phone = extracted.customer.phone;
        }
        if (extracted.customer.email && !args.body_primary_email) {
          args.body_primary_email = extracted.customer.email;
        }

        // Fine-grained address mapping (incremental)
        if (extracted.customer.address_street && !args.body_primary_address) {
          args.body_primary_address = extracted.customer.address_street;
        }
        if (extracted.customer.address_city && !args.body_city) {
          args.body_city = extracted.customer.address_city;
        }
        if (extracted.customer.address_state && !args.body_province) {
          args.body_province = extracted.customer.address_state;
        }
        if (extracted.customer.address_zipcode && !args.body_postal_code) {
          args.body_postal_code = extracted.customer.address_zipcode;
        }
        if (extracted.customer.address_country && !args.body_country) {
          args.body_country = extracted.customer.address_country;
        }

        console.log(`[WorkerMCPAgent] ✅ Mapped customer update with fine-grained address`);
      }
    }

    return args;
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
  config: AgentConfigV3,
  mcpAdapter?: MCPAdapterService,
  authToken?: string,
  agentProfileId: string = 'mcp_agent'
): WorkerMCPAgent {
  return new WorkerMCPAgent(config, mcpAdapter, authToken, agentProfileId);
}
