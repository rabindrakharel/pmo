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
import { createToolEnrichmentEngine, type ToolEnrichmentEngine } from '../lib/tool-enrichment-engine.service.js';

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
  private enrichmentEngine: ToolEnrichmentEngine;

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

    // Initialize generic enrichment engine from config (LOOSELY COUPLED!)
    this.enrichmentEngine = createToolEnrichmentEngine(config);

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

    // Get available MCP tools (SCOPED BY ENTITY_BOUNDARY)
    const entityBoundary = this.determineEntityBoundary(state);
    const availableTools = getMCPTools({
      categories: entityBoundary,
      maxTools: 40  // Limit to prevent token overflow
    });
    console.log(`[WorkerMCPAgent] 📋 Available MCP tools: ${availableTools.length} (scoped to entities: ${entityBoundary.join(', ')})`);

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

          // Parse arguments and enrich them with context data (GENERIC ENGINE - NO HARDCODING!)
          let toolArgs = JSON.parse(toolCall.function.arguments);
          toolArgs = this.enrichmentEngine.enrichToolArguments(toolCall.function.name, toolArgs, state);

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
   * Determine entity boundary dynamically based on session context
   *
   * Reads entity_boundary config and applies expansion rules based on:
   * - Current goal
   * - Extracted data (service catalog, project mentions, etc.)
   * - Conversation context
   *
   * @returns Array of entity categories to scope MCP tools
   */
  private determineEntityBoundary(state: AgentContextState): string[] {
    const entityBoundaryConfig = (this.agentProfile as any).entity_boundary;
    if (!entityBoundaryConfig) {
      // No config - return default categories
      return ['Customer', 'Task', 'Employee', 'Calendar', 'Settings'];
    }

    // Start with default entities
    let entities = new Set<string>(entityBoundaryConfig.default_entities || []);

    // Always include certain categories
    const alwaysInclude = entityBoundaryConfig.always_include_categories || [];
    alwaysInclude.forEach((cat: string) => entities.add(cat));

    // Apply expansion rules based on context
    const extracted = state.context.data_extraction_fields || {};
    const expansionRules = entityBoundaryConfig.expansion_rules || {};

    // Rule: If service catalog matched
    if (extracted.service?.catalog_match && expansionRules.if_service_catalog_matched) {
      expansionRules.if_service_catalog_matched.add_entities.forEach((e: string) => entities.add(e));
    }

    // Rule: If project mentioned
    if (extracted.project?.id && expansionRules.if_project_mentioned) {
      expansionRules.if_project_mentioned.add_entities.forEach((e: string) => entities.add(e));
    }

    // Rule: If appointment booking
    if (state.context.currentGoal?.includes('appointment') && expansionRules.if_appointment_booking) {
      expansionRules.if_appointment_booking.add_entities.forEach((e: string) => entities.add(e));
    }

    // Remove never include categories
    const neverInclude = entityBoundaryConfig.never_include_categories || [];
    neverInclude.forEach((cat: string) => entities.delete(cat));

    const result = Array.from(entities);
    console.log(`[WorkerMCPAgent] 🔍 Entity boundary determined: ${result.join(', ')}`);

    return result;
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
