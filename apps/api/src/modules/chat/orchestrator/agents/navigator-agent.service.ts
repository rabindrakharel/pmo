/**
 * Navigator Agent
 * Lightweight routing brain that decides next node using LLM
 * Input: agent_config.json (nodes + branching_conditions) + session_{session_id}_memory_data.json
 * Output: which node to execute next (no keyword matching, pure LLM decision)
 * READS session_{session_id}_memory_data.json file for complete context before routing
 * @module orchestrator/agents/navigator-agent
 */

import fs from 'fs/promises';
import path from 'path';
import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { DAGConfiguration, DAGContext } from './dag-types.js';

/**
 * Navigator Agent Decision
 */
export interface NavigatorDecision {
  nextNode: string;
  nextCourseOfAction: string;
  reason: string;
  matchedCondition?: string | null;
  mcpToolsNeeded?: string[];
  skipCurrent?: boolean;
  validationStatus: {
    onTrack: boolean;
    reason: string;
    suggestedCorrections?: string[];
    flagResets?: Record<string, number>;
  };
}

/**
 * Navigator Agent Service
 * Role: Validates conversation direction AND decides which node to go next
 * This unified agent combines validation + routing in a single LLM call
 * READS session_{session_id}_memory_data.json file for routing decisions
 */
export class NavigatorAgent {
  private dagConfig: DAGConfiguration;
  private contextDir: string = './logs/contexts';

  constructor(dagConfig: DAGConfiguration) {
    this.dagConfig = dagConfig;
  }

  /**
   * Read context from JSON file - DIRECT FILE READ
   */
  private async readContextFile(sessionId: string): Promise<any | null> {
    try {
      const filePath = path.join(this.contextDir, `session_${sessionId}_memory_data.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      console.log(`[NavigatorAgent] 📖 Read session_${sessionId.substring(0, 8)}..._memory_data.json (${parsed.metadata?.action || 'unknown'})`);
      return parsed;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`[NavigatorAgent] ❌ Failed to read context file: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Lightweight routing decision based on agent_config.json + session_{session_id}_memory_data.json
   * Navigator focuses on: which node next? Not on detailed prompt engineering.
   * ✅ FIX: Now accepts current exchange to avoid stale context issues
   */
  async decideNextNode(
    state: AgentContextState,
    skipValidation: boolean = false,
    currentExchange?: { customer: string; agent: string }
  ): Promise<NavigatorDecision> {
    console.log(`\n🧭 [NavigatorAgent] Deciding next node (lightweight routing)...`);
    console.log(`[NavigatorAgent] Current node: ${state.currentNode}`);

    // Read context file for complete context
    const contextFile = await this.readContextFile(state.sessionId);
    if (contextFile) {
      console.log(`[NavigatorAgent] 📊 Context file statistics:`);
      console.log(`   - Total messages: ${contextFile.statistics?.totalMessages || 0}`);
      console.log(`   - Nodes traversed: ${contextFile.statistics?.nodesTraversed || 0}`);
      console.log(`   - Flags set: ${contextFile.statistics?.flagsSet || 0}/${Object.keys(contextFile.context?.flags || {}).length}`);
    }

    const systemPrompt = this.buildUnifiedSystemPrompt(state.currentNode);
    const userPrompt = this.buildUnifiedUserPrompt(state, contextFile, currentExchange);

    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'planner',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      jsonMode: true,
      sessionId: state.sessionId,
    });

    const decision = JSON.parse(result.content || '{"validationStatus": {"onTrack": true, "reason": "OK"}, "nextNode": "END", "reason": "Unable to determine next node"}');

    // Log validation status
    const validation = decision.validationStatus || { onTrack: true, reason: 'No validation performed' };
    console.log(`[NavigatorAgent] ${validation.onTrack ? '✅' : '⚠️'} Validation: ${validation.onTrack ? 'On Track' : 'Off Track'}`);
    console.log(`[NavigatorAgent] 💭 Validation reason: ${validation.reason}`);

    // Log routing decision
    console.log(`[NavigatorAgent] ✅ Next node: ${decision.nextNode}`);
    console.log(`[NavigatorAgent] 📝 Next action: ${decision.nextCourseOfAction}`);
    console.log(`[NavigatorAgent] 💭 Routing reason: ${decision.reason}`);
    console.log(`[NavigatorAgent] 🎯 Matched condition: ${decision.matchedCondition || 'Using default_next_node'}`);

    if (decision.mcpToolsNeeded && decision.mcpToolsNeeded.length > 0) {
      console.log(`[NavigatorAgent] 🔧 MCP tools needed: ${decision.mcpToolsNeeded.join(', ')}`);
    }

    return {
      nextNode: decision.nextNode,
      nextCourseOfAction: decision.nextCourseOfAction || '',
      reason: decision.reason,
      matchedCondition: decision.matchedCondition || null,
      mcpToolsNeeded: decision.mcpToolsNeeded || [],
      skipCurrent: decision.skipCurrent || false,
      validationStatus: validation,
    };
  }

  /**
   * Build system prompt for condition-based routing
   * Navigator evaluates branching_conditions from agent_config.json against context to decide next node
   * OPTIMIZED: Only passes metadata for child nodes available from current node's branches
   */
  private buildUnifiedSystemPrompt(currentNodeName: string): string {
    const navigatorProfile = (this.dagConfig.AGENT_PROFILE as any)?.node_navigator_agent || {};

    // Get current node's branching conditions to find available child nodes
    const currentNodeConfig = this.dagConfig.nodes.find(n => n.node_name === currentNodeName);
    const branchingConditions = currentNodeConfig?.branching_conditions || [];
    const defaultNextNode = currentNodeConfig?.default_next_node;

    // Extract unique child node names from branching conditions + default
    const childNodeNames = new Set<string>();
    branchingConditions.forEach((bc: any) => {
      if (bc.child_node) childNodeNames.add(bc.child_node);
    });
    if (defaultNextNode && defaultNextNode !== 'null') {
      childNodeNames.add(defaultNextNode);
    }

    // Extract ONLY essential metadata for AVAILABLE child nodes
    // OPTIMIZED: Only pass role and goal (plan), not context_update
    const availableChildNodes = this.dagConfig.nodes
      .filter(n => childNodeNames.has(n.node_name))
      .map(n => ({
        node_name: n.node_name,
        role: (n as any).role || 'Node executor',
        goal: n.node_goal || 'Execute node action'
      }));

    return `${(this.dagConfig as any).llm_framework_instructions?.architecture || 'Multi-Agent Conversation System'}

YOUR ROLE: ${navigatorProfile.role || 'Navigator Agent - Condition-based routing decisions'}

You are the ROUTING BRAIN. Your job is to:
1. Review the current context state
2. Evaluate the current node's branching_conditions against context
3. CHOOSE 1 NODE from the available child nodes based on which condition matches
4. If NO conditions match, choose the default_next_node
5. Provide clear reasoning for your choice

AVAILABLE CHILD NODES (choose 1 from these):
${JSON.stringify(availableChildNodes, null, 2)}

DECISION PROCESS:
1. You will be given the current node's branching_conditions (conditions to evaluate)
2. You will be given the current context state (flags, mandatory fields, user message)
3. Evaluate EACH condition IN ORDER - FIRST match wins
4. CHOOSE 1 node from the available child nodes above based on which condition matches
5. If NO conditions match, choose the default_next_node

CONDITION EVALUATION STRATEGY:
Use these data sources to evaluate branching conditions:
1. node_traversal_path: Array of already-visited nodes (e.g., ["GREET_CUSTOMER", "Identify_Issue"])
2. summary_of_conversation_on_each_step_until_now: Conversation progress and what's been discussed
3. context_data: Gathered information (customer_name, customers_main_ask, customer_phone_number, etc.)

CONDITION EVALUATION EXAMPLES:
- "if issue already identified" → check if "Identify_Issue" in node_traversal_path
- "if customer changes issue" → check if user message contradicts context.customers_main_ask
- "if data not complete (missing mandatory customer_phone_number)" → check if context.customer_phone_number is empty
- "if customer does not consent" → check user message for rejection signals
- "if rapport already built" → check if "Console_Build_Rapport" in node_traversal_path

MANDATORY FIELDS TO VALIDATE:
- customers_main_ask (what customer needs)
- customer_phone_number (contact info)

CRITICAL RULES:
1. Evaluate branching_conditions IN ORDER - FIRST match wins
2. CHOOSE EXACTLY 1 node from available child nodes
3. NEVER return current node as nextNode
4. Return "END" only when waiting for user response (not in child node list)
5. Use node_traversal_path to track which nodes have already been executed

OUTPUT FORMAT (strict JSON):
{
  "validationStatus": {
    "onTrack": true/false,
    "reason": "brief validation explanation"
  },
  "nextNode": "EXACTLY one node name from available child nodes OR 'END'",
  "nextCourseOfAction": "one sentence describing what happens next",
  "reason": "which condition matched (or 'using default_next_node')",
  "matchedCondition": "exact condition text OR null if default",
  "mcpToolsNeeded": []
}`;
  }

  /**
   * Build user prompt with current node's branching conditions and ESSENTIAL context only
   * Navigator evaluates branching_conditions against context to decide next node
   * OPTIMIZED: Passes only last 3 messages and essential fields to avoid token limits
   * ✅ FIX: Now includes current exchange to prevent stale context issues
   */
  private buildUnifiedUserPrompt(
    state: AgentContextState,
    contextFile: any | null,
    currentExchange?: { customer: string; agent: string }
  ): string {
    const lastUserMessage = this.getLastUserMessage(state);

    // Get current node's full config from agent_config.json
    const currentNodeConfig = this.dagConfig.nodes.find(n => n.node_name === state.currentNode);
    const defaultNextNode = currentNodeConfig?.default_next_node || 'END';
    const branchingConditions = currentNodeConfig?.branching_conditions || [];

    // Include context from JSON file if available
    const fullContext = contextFile ? contextFile.context : state.context;

    // CRITICAL: Only last 2 conversation summary exchanges (reduced to make room for current)
    let recentSummary = (fullContext.summary_of_conversation_on_each_step_until_now || []).slice(-2);

    // ✅ FIX: Add current exchange if provided (most recent, not yet in summary)
    if (currentExchange) {
      const nextIndex = (fullContext.summary_of_conversation_on_each_step_until_now || []).length;
      recentSummary = [
        ...recentSummary,
        {
          index: nextIndex,
          customer: currentExchange.customer,
          agent: currentExchange.agent,
          isCurrent: true  // Mark as current for clarity
        }
      ];
    }

    // Extract node traversal path (which nodes have been visited)
    const nodeTraversalPath = fullContext.node_traversal_path || [];

    // Extract ONLY essential context fields for routing (mandatory fields + actively tracked fields)
    const mandatoryFields = (this.dagConfig as any).global_context_schema_semantics?.mandatory_fields || ['customers_main_ask', 'customer_phone_number'];
    const essentialContext: Record<string, any> = {};

    // Add mandatory fields
    for (const field of mandatoryFields) {
      essentialContext[field] = fullContext[field] || '(not set)';
    }

    // Add next_node_to_go_to if set (routing hint)
    if (fullContext.next_node_to_go_to) {
      essentialContext.next_node_to_go_to = fullContext.next_node_to_go_to;
    }

    // Add fields that have been actively set (non-empty, non-default values)
    const activeFields = ['customer_id', 'task_id', 'appointment_details', 'matching_service_catalog_to_solve_customers_issue'];
    for (const field of activeFields) {
      if (fullContext[field] && fullContext[field] !== '' && fullContext[field] !== '(not set)') {
        essentialContext[field] = fullContext[field];
      }
    }

    // Count available branches for clear messaging
    const branchCount = branchingConditions.length + (defaultNextNode ? 1 : 0);

    return `ROUTING DECISION: CHOOSE 1 NODE FROM ${branchCount} AVAILABLE BRANCHES

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT NODE JUST EXECUTED: ${state.currentNode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 BRANCHING CONDITIONS (evaluate in order, first match wins):
${JSON.stringify(branchingConditions, null, 2)}

⚠️ DEFAULT BRANCH (fallback if no conditions match):
${defaultNextNode}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT FOR EVALUATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛤️  Node Traversal Path (which nodes have already been executed):
${JSON.stringify(nodeTraversalPath, null, 2)}

📝 Recent Conversation (including CURRENT exchange):
${recentSummary.map((ex: any) => {
  const label = ex.isCurrent ? `[Exchange #${ex.index}] 🔴 CURRENT (MOST RECENT)` : `[Exchange #${ex.index}]`;
  return `${label}\nCustomer: "${ex.customer}"\nAgent: "${ex.agent}"`;
}).join('\n\n')}

📊 Mandatory Fields:
- customers_main_ask: ${essentialContext.customers_main_ask || '(not set)'}
- customer_phone_number: ${essentialContext.customer_phone_number || '(not set)'}

💬 Last User Message:
${lastUserMessage || '(no message)'}

🔍 Active Context Fields:
${JSON.stringify(essentialContext, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK: CHOOSE EXACTLY 1 NODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Evaluate EACH branching condition IN ORDER against context above
2. FIRST matching condition → choose that condition's child_node
3. NO conditions match → choose default: ${defaultNextNode}
4. Return EXACTLY 1 node from the available child nodes in system prompt

⚠️ CRITICAL:
- NEVER return current node: ${state.currentNode}
- Choose from available child nodes ONLY (see system prompt)
- First match wins - stop evaluating after first match
- Provide clear reason explaining which condition matched

Return your routing decision as strict JSON.`;
  }

  /**
   * Get last user message
   * ✅ UPDATED: Use summary instead of messages array (no longer populated)
   */
  private getLastUserMessage(state: AgentContextState): string {
    const summary = state.context.summary_of_conversation_on_each_step_until_now || [];
    return summary.length > 0 ? summary[summary.length - 1].customer : '';
  }

  /**
   * Determine if MCP tools are needed based on context
   * Uses simple heuristics to suggest tools based on missing context fields
   * Note: MCP tools are now defined in the MCP manifest (apps/mcp-server/src/api-manifest.ts)
   * and the LLM makes the final decision on which tools to call
   */
  determineMCPToolsNeeded(context: DAGContext): string[] {
    const tools: string[] = [];

    // Simple heuristics based on context field presence
    // The LLM will make the final decision using tools from the MCP manifest

    // Suggest service catalog lookup if customer issue is known but service not matched
    if (context.customers_main_ask && !context.matching_service_catalog_to_solve_customers_issue) {
      tools.push('setting_list'); // Get service catalog from settings
      console.log('[NavigatorAgent] 🔧 Suggest: Fetch service catalog to match customer issue');
    }

    // Suggest customer lookup/creation if phone known but customer_id missing
    if (context.customer_phone_number && !context.customer_id) {
      tools.push('customer_list', 'customer_create'); // Search or create customer
      console.log('[NavigatorAgent] 🔧 Suggest: Lookup or create customer record');
    }

    // Suggest task creation if customer and issue are known but no task created
    if (context.customer_id && context.customers_main_ask && !context.task_id) {
      tools.push('task_create');
      console.log('[NavigatorAgent] 🔧 Suggest: Create task for customer issue');
    }

    // Suggest appointment booking if task exists but no appointment scheduled
    if (context.task_id && !context.appointment_details) {
      tools.push('person_calendar_get_available', 'person_calendar_book'); // Check availability and book
      console.log('[NavigatorAgent] 🔧 Suggest: Schedule appointment for task');
    }

    return tools;
  }
}

/**
 * Create navigator agent instance
 */
export function createNavigatorAgent(dagConfig: DAGConfiguration): NavigatorAgent {
  return new NavigatorAgent(dagConfig);
}
