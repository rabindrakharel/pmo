/**
 * Navigator Agent
 * Lightweight routing brain that decides next node using LLM
 * Input: dag.json (nodes + branching_conditions) + minimal context
 * Output: which node to execute next (no keyword matching, pure LLM decision)
 * @module orchestrator/agents/navigator-agent
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentContextState } from './agent-context.service.js';
import type { DAGConfiguration, DAGContext } from '../langgraph/dag-types.js';

/**
 * Navigator Agent Decision
 */
export interface NavigatorDecision {
  nextNode: string;
  nextCourseOfAction: string;
  reason: string;
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
 */
export class NavigatorAgent {
  private dagConfig: DAGConfiguration;

  constructor(dagConfig: DAGConfiguration) {
    this.dagConfig = dagConfig;
  }

  /**
   * Lightweight routing decision based on dag.json + minimal context
   * Navigator focuses on: which node next? Not on detailed prompt engineering.
   */
  async decideNextNode(state: AgentContextState, skipValidation: boolean = false): Promise<NavigatorDecision> {
    console.log(`\n🧭 [NavigatorAgent] Deciding next node (lightweight routing)...`);
    console.log(`[NavigatorAgent] Current node: ${state.currentNode}`);

    const systemPrompt = this.buildUnifiedSystemPrompt();
    const userPrompt = this.buildUnifiedUserPrompt(state);

    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'planner',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      jsonMode: true,
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

    if (decision.mcpToolsNeeded && decision.mcpToolsNeeded.length > 0) {
      console.log(`[NavigatorAgent] 🔧 MCP tools needed: ${decision.mcpToolsNeeded.join(', ')}`);
    }

    return {
      nextNode: decision.nextNode,
      nextCourseOfAction: decision.nextCourseOfAction || '',
      reason: decision.reason,
      mcpToolsNeeded: decision.mcpToolsNeeded || [],
      skipCurrent: decision.skipCurrent || false,
      validationStatus: validation,
    };
  }

  /**
   * Build lightweight system prompt focused on routing decisions
   * Navigator only needs to know: nodes, flags, mandatory fields, flow rules
   */
  private buildUnifiedSystemPrompt(): string {
    const navigatorProfile = (this.dagConfig.AGENT_PROFILE as any)?.node_navigator_agent || {};

    // Extract node flow + branching_conditions from dag.json
    const nodeFlow = this.dagConfig.nodes.map(n => ({
      name: n.node_name,
      goal: n.node_goal,
      default_next: n.default_next_node,
      branching_conditions: n.branching_conditions.map(b => ({
        condition: b.condition,
        child_node: b.child_node
      }))
    }));

    return `${(this.dagConfig as any).llm_framework_instructions?.architecture || 'Multi-Agent Conversation System'}

YOUR ROLE: ${navigatorProfile.role || 'Navigator Agent - Pure LLM routing decisions'}

You are the ROUTING BRAIN. NO RULES. Pure LLM understanding of user intent and conversation flow.

AVAILABLE NODES (from dag.json):
${JSON.stringify(nodeFlow, null, 2)}

Note: branching_conditions are DESCRIPTIVE HINTS ONLY, not rules to follow.
Note: default_next_node is a SUGGESTION, not mandatory.

YOUR DECISION PROCESS:
1. Understand user's intent from their message
2. Analyze conversation context (flags, mandatory fields, flow)
3. Decide which node makes LOGICAL sense next
4. Skip nodes already completed (flag=1)
5. Ensure mandatory fields get collected: customers_main_ask, customer_phone_number
6. Use END when customer needs to respond
7. Use use_mcp_to_get_info when external data needed

THINK LIKE A HUMAN CONVERSATION MANAGER:
- If customer changes topic → route to Identify_Issue
- If customer gives data → update flags, move forward
- If customer seems confused → maybe empathize or clarify
- If plan rejected → go back to planning
- If all done → say goodbye

NO KEYWORD MATCHING. NO RULE CHECKING. Just understand and route.

OUTPUT:
{
  "validationStatus": {
    "onTrack": true/false,
    "reason": "brief explanation",
    "flagResets": {}
  },
  "nextNode": "node_name",
  "nextCourseOfAction": "one sentence plan",
  "reason": "routing reason",
  "mcpToolsNeeded": [],
  "skipCurrent": false
}`;
  }

  /**
   * Build lightweight user prompt with ONLY routing essentials
   * Navigator doesn't need full context - only routing signals
   */
  private buildUnifiedUserPrompt(state: AgentContextState): string {
    const flags = state.context.flags || {};
    const completedSteps = Object.entries(flags)
      .filter(([_, value]) => value === 1)
      .map(([key, _]) => key);

    const lastUserMessage = this.getLastUserMessage(state);

    // Extract ONLY routing signals (not full context)
    const routingSignals = {
      current_node: state.currentNode,
      previous_node: state.previousNode || 'N/A',
      completed_flags: completedSteps,
      mandatory_fields: {
        customers_main_ask: !!state.context.customers_main_ask,
        customer_phone_number: !!state.context.customer_phone_number
      },
      has_service_catalog: !!state.context.matching_service_catalog_to_solve_customers_issue,
      has_task_id: !!state.context.task_id,
      has_plan: !!state.context.next_course_of_action,
      node_path: state.context.node_traversal_path || [],
      last_user_message: lastUserMessage
    };

    return `ROUTING DECISION REQUIRED

Context Signals:
${JSON.stringify(routingSignals, null, 2)}

Analyze the conversation:
- What did the user just say?
- What's the natural next step?
- Are we collecting required info?
- Is conversation progressing logically?

NO RULES. Use your understanding of natural conversation flow.

Return routing decision as JSON.`;
  }

  /**
   * Get last user message
   */
  private getLastUserMessage(state: AgentContextState): string {
    const userMessages = state.messages.filter(m => m.role === 'user');
    return userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
  }

  /**
   * Check if node should be skipped based on flags
   */
  shouldSkipNode(nodeName: string, context: DAGContext): boolean {
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
    if (flagName && context.flags) {
      return context.flags[flagName] === 1;
    }

    return false;
  }

  /**
   * Determine if MCP tools are needed based on context
   * This is now just a helper - LLM makes the actual decision in decideNextNode()
   */
  determineMCPToolsNeeded(context: DAGContext): string[] {
    const tools: string[] = [];

    // Simple context checks (LLM will make final decision)
    if (context.customers_main_ask && !context.matching_service_catalog_to_solve_customers_issue) {
      tools.push('fetch_service_catalog');
    }

    if (context.customers_main_ask && !context.related_entities_for_customers_ask) {
      tools.push('fetch_related_entities');
    }

    if (context.matching_service_catalog_to_solve_customers_issue && !context.task_id) {
      tools.push('create_task');
    }

    if (context.task_id && !context.appointment_details) {
      tools.push('fetch_appointment_details');
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
