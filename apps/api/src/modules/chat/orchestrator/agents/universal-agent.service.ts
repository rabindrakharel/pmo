/**
 * Universal Agent Template
 * Single agent implementation that morphs into different behaviors based on agent_config.json profiles
 * Eliminates need for separate navigator-agent, worker-agent files
 * @module orchestrator/agents/universal-agent
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { DAGConfiguration, DAGContext } from './dag-types.js';
import type { MCPAdapterService } from '../../mcp-adapter.service.js';

/**
 * Agent Profile from agent_config.json
 */
export interface AgentProfile {
  role: string;
  input_context_template?: string;
  input_context_variables?: Record<string, string>;
  responsibilities: string[];
  decision_inputs: string;
  decision_outputs: string;
}

/**
 * MCP Manifest (passed separately when needed)
 */
export interface MCPManifest {
  tools: Array<{
    tool_name: string;
    purpose: string;
    when_to_use: string;
    input_parameters: Record<string, any>;
    returns: {
      format: string;
      example: any;
    };
    context_updates: {
      field?: string;
      fields?: Array<{
        field: string;
        value: string;
      }>;
      update_logic?: string;
    };
  }>;
}

/**
 * Agent Execution Result
 */
export interface AgentResult {
  output: any;
  contextUpdates?: Partial<DAGContext>;
  metadata?: Record<string, any>;
}

/**
 * Universal Agent
 * Reads behavior from agent_config.json AGENT_PROFILE and morphs accordingly
 * MCP manifest passed separately when needed
 */
export class UniversalAgent {
  private dagConfig: DAGConfiguration;
  private agentType: string;
  private profile: AgentProfile;
  private mcpAdapter?: MCPAdapterService;
  private authToken?: string;
  private mcpManifest?: MCPManifest;

  constructor(
    dagConfig: DAGConfiguration,
    agentType: string,
    mcpAdapter?: MCPAdapterService,
    authToken?: string
  ) {
    this.dagConfig = dagConfig;
    this.agentType = agentType;
    this.mcpAdapter = mcpAdapter;
    this.authToken = authToken;

    // Load agent profile from agent_config.json
    this.profile = this.loadAgentProfile(agentType);

    console.log(`[UniversalAgent] 🤖 Initialized as: ${agentType}`);
    console.log(`[UniversalAgent] 📋 Role: ${this.profile.role}`);
    console.log(`[UniversalAgent] 🎯 Responsibilities: ${this.profile.responsibilities.length}`);
  }

  /**
   * Load agent profile from agent_config.json AGENT_PROFILE section
   */
  private loadAgentProfile(agentType: string): AgentProfile {
    const agentProfilesSection = this.dagConfig.AGENT_PROFILE as any;

    // Map agent type to profile key in agent_config.json
    const profileKey = this.getProfileKey(agentType);
    const profile = agentProfilesSection[profileKey];

    if (!profile) {
      throw new Error(`Agent profile not found in agent_config.json: ${profileKey}`);
    }

    return {
      role: profile.role || 'Universal Agent',
      input_context_template: profile.input_context_template,
      input_context_variables: profile.input_context_variables || {},
      responsibilities: profile.responsibilities || [],
      decision_inputs: profile.decision_inputs || '',
      decision_outputs: profile.decision_outputs || '',
    };
  }

  /**
   * Map agent type to profile key in agent_config.json
   */
  private getProfileKey(agentType: string): string {
    const mapping: Record<string, string> = {
      'navigator': 'node_navigator_agent',
      'worker': 'worker_agent',
      'planner': 'node_navigator_agent', // alias
    };
    return mapping[agentType] || agentType;
  }

  /**
   * Set MCP manifest (passed separately when needed)
   */
  setMCPManifest(manifest: MCPManifest) {
    this.mcpManifest = manifest;
    console.log(`[UniversalAgent:${this.agentType}] 🔧 MCP manifest loaded: ${manifest.tools.length} tools`);
  }

  /**
   * Execute agent task based on profile
   * This is the universal execution method that morphs based on agent type
   * MCP manifest can be passed separately if/when needed
   */
  async execute(
    state: AgentContextState,
    taskContext?: Record<string, any>,
    mcpManifest?: MCPManifest
  ): Promise<AgentResult> {
    console.log(`\n🤖 [UniversalAgent:${this.agentType}] Executing task`);

    // Set MCP manifest if provided for this execution
    if (mcpManifest) {
      this.mcpManifest = mcpManifest;
      console.log(`[UniversalAgent:${this.agentType}] 🔧 MCP manifest provided: ${mcpManifest.tools.length} tools`);
    }

    // Build input context using profile's template and variables
    const inputContext = this.buildInputContext(state, taskContext);

    // Build system prompt from profile
    const systemPrompt = this.buildSystemPrompt();

    // Build user prompt with input context
    const userPrompt = this.buildUserPrompt(inputContext);

    // Call LLM
    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: this.agentType,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: this.getTemperature(),
      jsonMode: this.requiresJsonMode(),
    });

    // Parse and validate output
    const output = this.parseOutput(result.content || '{}');

    // Extract context updates based on profile's decision_outputs
    const contextUpdates = this.extractContextUpdates(output, state.context);

    console.log(`[UniversalAgent:${this.agentType}] ✅ Execution complete`);

    return {
      output,
      contextUpdates,
      metadata: {
        agentType: this.agentType,
        role: this.profile.role,
      },
    };
  }

  /**
   * Build input context by replacing variables in template
   * Uses profile's input_context_template and input_context_variables
   */
  private buildInputContext(
    state: AgentContextState,
    taskContext?: Record<string, any>
  ): Record<string, any> {
    const inputContext: Record<string, any> = {};

    // Get current node config if available
    const currentNode = this.dagConfig.nodes.find(n => n.node_name === state.currentNode);

    // Build variable values based on profile's input_context_variables
    for (const [varName, varDescription] of Object.entries(this.profile.input_context_variables || {})) {
      if (varDescription.includes('context.summary_of_conversation_on_each_step_until_now')) {
        inputContext[varName] = state.context.summary_of_conversation_on_each_step_until_now || [];
      } else if (varDescription.includes('context.node_traversal_path')) {
        inputContext[varName] = state.context.node_traversal_path || [];
      } else if (varDescription.includes('context.json')) {
        inputContext[varName] = state.context;
      } else if (varDescription.includes('current_node.branching_conditions')) {
        inputContext[varName] = currentNode?.branching_conditions || [];
      } else if (varDescription.includes('current_node.node_name')) {
        inputContext[varName] = currentNode?.node_name || state.currentNode;
      } else if (varDescription.includes('current_node.prompt_templates')) {
        inputContext[varName] = currentNode?.prompt_templates || '';
      } else if (taskContext && taskContext[varName]) {
        inputContext[varName] = taskContext[varName];
      }
    }

    return inputContext;
  }

  /**
   * Build system prompt from agent profile
   */
  private buildSystemPrompt(): string {
    const llmFramework = (this.dagConfig as any).llm_framework_instructions || {};

    return `${llmFramework.architecture || 'Multi-Agent System'}

YOUR ROLE: ${this.profile.role}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AGENT PROFILE: ${this.agentType.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSIBILITIES (from dag.json):
${this.profile.responsibilities.map((r, i) => `${i + 1}. ${r}`).join('\n')}

DECISION INPUTS:
${this.profile.decision_inputs}

DECISION OUTPUTS:
${this.profile.decision_outputs}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Read the input context provided in the user message
2. Execute each responsibility listed above in order
3. Generate outputs as specified in DECISION OUTPUTS
4. Return structured data in JSON format

IMPORTANT:
- Follow responsibilities exactly as defined in dag.json
- Only output fields specified in decision_outputs
- Use context data to make informed decisions
- Do not invent or assume data not provided

Execute your task now:`;
  }

  /**
   * Build user prompt with input context
   */
  private buildUserPrompt(inputContext: Record<string, any>): string {
    // Use profile's input_context_template if available
    let prompt = this.profile.input_context_template || 'Execute task with the following context:';

    // Replace variables in template
    for (const [varName, value] of Object.entries(inputContext)) {
      const placeholder = `{${varName}}`;
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      prompt = prompt.replace(placeholder, stringValue);
    }

    return prompt;
  }

  /**
   * Parse agent output
   */
  private parseOutput(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  }

  /**
   * Extract context updates from agent output
   * Based on profile's decision_outputs specification
   */
  private extractContextUpdates(output: any, currentContext: DAGContext): Partial<DAGContext> {
    const updates: Partial<DAGContext> = {};

    // Parse decision_outputs to know what fields to extract
    const outputFields = this.parseDecisionOutputs();

    for (const field of outputFields) {
      if (output[field] !== undefined) {
        updates[field] = output[field];
      }
    }

    // Node execution tracking is now handled by node_traversal_path in orchestrator
    // No flag-based tracking needed here

    return updates;
  }

  /**
   * Parse decision_outputs string to extract field names
   */
  private parseDecisionOutputs(): string[] {
    const fields: string[] = [];
    const outputSpec = this.profile.decision_outputs;

    // Extract context field names from decision_outputs
    // Example: "Updates context.next_node_to_go_to (string)" -> "next_node_to_go_to"
    const contextFieldPattern = /context\.(\w+)/g;
    let match;
    while ((match = contextFieldPattern.exec(outputSpec)) !== null) {
      fields.push(match[1]);
    }

    // Also look for common output fields
    if (outputSpec.includes('next_node')) fields.push('nextNode', 'next_node_to_go_to');
    if (outputSpec.includes('next_course_of_action')) fields.push('nextCourseOfAction', 'next_course_of_action');
    if (outputSpec.includes('node_traversal_path')) fields.push('node_traversal_path');
    if (outputSpec.includes('customer_name')) fields.push('customer_name');
    if (outputSpec.includes('customer_phone_number')) fields.push('customer_phone_number');
    if (outputSpec.includes('customers_main_ask')) fields.push('customers_main_ask');
    if (outputSpec.includes('response')) fields.push('response');

    return [...new Set(fields)]; // Remove duplicates
  }

  /**
   * Get temperature based on agent type
   */
  private getTemperature(): number {
    const tempMap: Record<string, number> = {
      'navigator': 0.1,
      'worker': 0.7,
      'planner': 0.1,
    };
    return tempMap[this.agentType] || 0.5;
  }

  /**
   * Check if agent requires JSON mode
   */
  private requiresJsonMode(): boolean {
    return this.agentType === 'navigator' || this.agentType === 'planner';
  }

  /**
   * Get agent profile
   */
  getProfile(): AgentProfile {
    return this.profile;
  }

  /**
   * Set auth token for MCP calls
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }
}

/**
 * Create universal agent instance
 */
export function createUniversalAgent(
  dagConfig: DAGConfiguration,
  agentType: string,
  mcpAdapter?: MCPAdapterService,
  authToken?: string
): UniversalAgent {
  return new UniversalAgent(dagConfig, agentType, mcpAdapter, authToken);
}
