# Agentic AI Refactoring Plan - Part 2

> **Continuation of**: AGENTIC_REFACTORING_PLAN.md
> **Covers**: Phases 2-6
> **Version**: 3.0.0

---

## Phase 2: Agent Autonomy Enhancement

**Duration**: Week 2
**Complexity**: High
**Risk**: Medium
**Dependencies**: Phase 1 complete

### 2.1 Problem Statement

**Current Agent Behavior**:
```typescript
// WorkerReplyAgent receives node-specific instructions
const node = getNode('Empathize');
const response = await workerReplyAgent.execute({
  role: node.role,              // "empathetic support agent"
  goal: node.node_goal,         // "express empathy"
  prompt: node.prompt_templates // "You are polite..."
});
// Agent is a chameleon - changes identity per node
```

**Issues**:
1. **No persistent identity** - Agent behavior changes every node
2. **No autonomous decision-making** - Agents execute instructions, don't think
3. **Tightly coupled** - Agents can't be reused outside this flow
4. **No reasoning** - Agents don't explain their decisions

**Goal**: Agents with **persistent identities**, **autonomous reasoning**, and **ReAct pattern**

---

### 2.2 ReAct Pattern (Reason + Act)

**What is ReAct?**

Modern agentic systems use **ReAct** (Reasoning + Acting):

```
1. OBSERVE: Agent receives state and goal
2. THINK: Agent reasons about what to do next
3. ACT: Agent takes action (ask question, use tool, etc.)
4. OBSERVE: Agent sees result of action
5. Loop until goal achieved
```

**Example**:
```
Goal: Get customer phone number

OBSERVE: Customer said "I need drywall repair" (no phone number mentioned)
THINK: I need phone number to create service request. Should I ask directly or build rapport first?
      Customer seems frustrated → Build rapport before asking for data
ACT: "I understand drywall damage can be stressful. I'm here to help."

OBSERVE: Customer said "Thanks, yes it's urgent"
THINK: Customer is engaged, rapport established. Good time to ask for phone.
ACT: "To get started, may I have your phone number?"

OBSERVE: Customer said "555-1234"
THINK: Phone number collected! Goal achieved.
ACT: Store phone number, move to next goal
```

**Key Differences from Current System**:

| Aspect | Current | ReAct |
|--------|---------|-------|
| **Decision-making** | Follows node instructions | Autonomous reasoning |
| **Adaptability** | Fixed per node | Adapts to conversation flow |
| **Explainability** | No explanation | Reasoning is logged |
| **Error handling** | Fails silently | Reasons about errors |

---

### 2.3 Autonomous Agent Architecture

**File**: `apps/api/src/modules/chat/orchestrator/agents/autonomous-conversational-agent.service.ts`

```typescript
/**
 * Autonomous Conversational Agent with ReAct Pattern
 *
 * Capabilities:
 * - Persistent identity across conversation
 * - Autonomous decision-making (what to say/ask)
 * - Reasoning about conversation state
 * - Tactic selection from tactics library
 * - Self-reflection on responses
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentProfile, ConversationTactic } from '../config/agent-config.schema.js';
import type { ConversationContext } from '../types/context.types.js';

export interface AgentAction {
  type: 'speak' | 'ask_question' | 'use_tool' | 'wait' | 'escalate';
  content: string;
  reasoning: string;
  confidence: number;
  tactic_used?: string;
}

export interface AgentThought {
  observation: string;
  reasoning: string;
  next_action: AgentAction;
}

export class AutonomousConversationalAgent {
  private profile: AgentProfile;
  private tacticsLibrary: Record<string, ConversationTactic>;
  private conversationMemory: Array<{
    thought: AgentThought;
    action: AgentAction;
    result: string;
  }> = [];

  constructor(
    profile: AgentProfile,
    tacticsLibrary: Record<string, ConversationTactic>
  ) {
    this.profile = profile;
    this.tacticsLibrary = tacticsLibrary;
  }

  /**
   * CORE METHOD: ReAct Loop - Reason about what to do, then act
   * This replaces the old executeNode() pattern
   */
  async decide_and_act(
    currentGoal: string,
    context: ConversationContext,
    customerMessage: string,
    conversationHistory: Array<{ customer: string; agent: string }>
  ): Promise<AgentAction> {
    console.log(`\n🧠 [${this.profile.identity}] ReAct: Deciding next action...`);

    // STEP 1: OBSERVE - Analyze current situation
    const observation = this.buildObservation(
      currentGoal,
      context,
      customerMessage,
      conversationHistory
    );

    console.log(`[Agent] 👁️  OBSERVE: ${observation.substring(0, 100)}...`);

    // STEP 2: THINK - Reason about what to do
    const thought = await this.reason(observation, currentGoal, context);

    console.log(`[Agent] 💭 THINK: ${thought.reasoning}`);
    console.log(`[Agent] 🎯 DECIDED: ${thought.next_action.type} (confidence: ${thought.next_action.confidence})`);

    // STEP 3: ACT - Take the decided action
    const action = thought.next_action;

    // Store in memory for future reasoning
    this.conversationMemory.push({
      thought,
      action,
      result: '' // Will be filled after action execution
    });

    return action;
  }

  /**
   * STEP 1: Build observation of current situation
   */
  private buildObservation(
    currentGoal: string,
    context: ConversationContext,
    customerMessage: string,
    conversationHistory: Array<{ customer: string; agent: string }>
  ): string {
    const recentHistory = conversationHistory.slice(-3);

    return `
CURRENT GOAL: ${currentGoal}

CUSTOMER'S LATEST MESSAGE: "${customerMessage}"

CONVERSATION SO FAR (last 3 exchanges):
${recentHistory.map((ex, i) => `
  Exchange ${i + 1}:
    Customer: ${ex.customer}
    Agent: ${ex.agent}
`).join('\n')}

CONTEXT STATE:
  - Customer Issue: ${context.customers_main_ask || 'Not yet identified'}
  - Customer Phone: ${context.customer_phone_number || 'Not provided'}
  - Customer Name: ${context.customer_name || 'Unknown'}
  - Task Created: ${context.service?.task_id ? 'Yes' : 'No'}
  - Appointment Scheduled: ${context.service?.appointment_details ? 'Yes' : 'No'}

PREVIOUS ACTIONS I TOOK:
${this.conversationMemory.slice(-2).map(m => `
  - ${m.action.type}: "${m.action.content}" (Reasoning: ${m.reasoning})
`).join('\n') || '  (None yet - this is the start)'}
`.trim();
  }

  /**
   * STEP 2: Reason about what to do next
   * This is where autonomous decision-making happens
   */
  private async reason(
    observation: string,
    currentGoal: string,
    context: ConversationContext
  ): Promise<AgentThought> {
    const systemPrompt = this.buildReasoningSystemPrompt(currentGoal);
    const userPrompt = `${observation}

Based on the above, what should I do next to achieve the goal "${currentGoal}"?`;

    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'planner',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Slightly creative for natural conversation
      jsonMode: true
    });

    const thought = JSON.parse(result.content || '{}');

    return {
      observation,
      reasoning: thought.reasoning,
      next_action: {
        type: thought.action_type,
        content: thought.action_content,
        reasoning: thought.reasoning,
        confidence: thought.confidence || 0.8,
        tactic_used: thought.tactic_used
      }
    };
  }

  /**
   * Build reasoning system prompt
   */
  private buildReasoningSystemPrompt(currentGoal: string): string {
    const availableTactics = Object.entries(this.tacticsLibrary)
      .map(([name, tactic]) => `  - ${name}: ${tactic.description}\n    When to use: ${tactic.when_to_use}`)
      .join('\n');

    return `You are ${this.profile.identity}.

Your Personality:
${JSON.stringify(this.profile.personality_traits, null, 2)}

Your Core System Prompt:
${this.profile.system_prompt}

Current Goal: ${currentGoal}

Available Conversation Tactics:
${availableTactics}

Your Task - ReAct Pattern:
1. OBSERVE: Review the conversation state (provided by user)
2. THINK: Reason about what to do next to achieve the goal
3. ACT: Decide on a specific action

Available Action Types:
- speak: Make a statement to customer (empathy, information sharing)
- ask_question: Ask customer a question (data gathering, clarification)
- use_tool: Request to use an MCP tool (requires specific tool name)
- wait: Wait for customer response (no action needed)
- escalate: Escalate to human agent (when situation is beyond capability)

Your Reasoning Process:
1. Analyze customer's latest message and conversation history
2. Identify what's missing to achieve the current goal
3. Consider conversation flow (don't ask questions already answered!)
4. Select appropriate tactic from tactics library
5. Decide action type and content
6. Assess confidence in your decision (0.0 to 1.0)

Output JSON Schema:
{
  "reasoning": "Your step-by-step thought process about what to do next",
  "action_type": "speak | ask_question | use_tool | wait | escalate",
  "action_content": "The actual text to say or tool to use",
  "tactic_used": "Name of tactic from library (if applicable)",
  "confidence": 0.85,
  "fallback_action": "Alternative action if primary fails"
}

Example Output:
{
  "reasoning": "Customer mentioned drywall issue but was vague. I need more specifics to help effectively. Using clarifying_questions tactic.",
  "action_type": "ask_question",
  "action_content": "Could you tell me more about what happened with the drywall? Is it a small patch or a larger area?",
  "tactic_used": "clarifying_questions",
  "confidence": 0.9,
  "fallback_action": "If customer doesn't provide details, acknowledge and move to gathering contact info"
}

Critical Rules:
1. NEVER repeat questions already answered
2. Build on previous conversation naturally
3. Match customer's emotional tone (frustrated → empathy first)
4. Keep responses concise (1-3 sentences for speak, 1 sentence for ask_question)
5. If uncertain (confidence < 0.6), choose 'wait' or ask clarifying question
`;
  }

  /**
   * Self-reflection: Evaluate if previous action was effective
   * This enables learning and adaptation
   */
  async reflect_on_action(
    action: AgentAction,
    customerResponse: string
  ): Promise<{ effective: boolean; reason: string; adjustment?: string }> {
    if (this.conversationMemory.length === 0) {
      return { effective: true, reason: 'No previous actions to evaluate' };
    }

    const systemPrompt = `You are a conversation quality evaluator.

Task: Evaluate if the agent's previous action was effective based on customer's response.

Evaluation Criteria:
- Did customer provide requested information?
- Did customer's emotional tone improve or worsen?
- Was the conversation moving forward or stuck?
- Did agent violate any rules (repetition, irrelevance)?

Output JSON:
{
  "effective": boolean,
  "reason": "Brief explanation",
  "adjustment": "Suggested adjustment for next action (if ineffective)"
}`;

    const userPrompt = `Agent Action: ${action.type} - "${action.content}"
Customer Response: "${customerResponse}"

Was the action effective?`;

    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'evaluator',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      jsonMode: true
    });

    const reflection = JSON.parse(result.content || '{"effective": true, "reason": "Unknown"}');

    console.log(`[Agent] 🔍 REFLECT: ${reflection.effective ? '✅ Effective' : '❌ Ineffective'} - ${reflection.reason}`);

    if (!reflection.effective && reflection.adjustment) {
      console.log(`[Agent] 💡 ADJUST: ${reflection.adjustment}`);
    }

    return reflection;
  }

  /**
   * Select tactic from library based on situation
   */
  private selectTactic(
    situation: string,
    availableTactics: string[]
  ): string | null {
    // This could be LLM-powered for smarter selection
    // For now, simple keyword matching

    if (situation.includes('frustrated') || situation.includes('upset')) {
      return 'empathetic_listening';
    }
    if (situation.includes('unclear') || situation.includes('vague')) {
      return 'clarifying_questions';
    }
    if (situation.includes('data') || situation.includes('information')) {
      return 'incremental_data_gathering';
    }

    return availableTactics[0] || null;
  }
}

export function createAutonomousConversationalAgent(
  profile: AgentProfile,
  tacticsLibrary: Record<string, ConversationTactic>
): AutonomousConversationalAgent {
  return new AutonomousConversationalAgent(profile, tacticsLibrary);
}
```

---

### 2.4 Decoupling Agents from Goals

**Problem**: Currently, agents are node-specific. We need agents that work across multiple goals.

**Solution**: Agent profiles are loaded from config, agents execute any goal they're allowed to handle.

**File**: `apps/api/src/modules/chat/orchestrator/agents/agent-registry.service.ts`

```typescript
/**
 * Agent Registry
 * Manages agent instances and selects appropriate agent for goal
 */

import type { AgentConfigV3, AgentProfile } from '../config/agent-config.schema.js';
import { AutonomousConversationalAgent, createAutonomousConversationalAgent } from './autonomous-conversational-agent.service.js';
import { AutonomousMCPAgent, createAutonomousMCPAgent } from './autonomous-mcp-agent.service.js';
import { AutonomousExtractionAgent, createAutonomousExtractionAgent } from './autonomous-extraction-agent.service.js';

export type AgentInstance =
  | AutonomousConversationalAgent
  | AutonomousMCPAgent
  | AutonomousExtractionAgent;

export class AgentRegistry {
  private agents: Map<string, AgentInstance> = new Map();
  private config: AgentConfigV3;

  constructor(config: AgentConfigV3) {
    this.config = config;
    this.initializeAgents();
  }

  /**
   * Initialize all agents from config
   */
  private initializeAgents(): void {
    console.log('[AgentRegistry] 🏗️  Initializing agents from config...');

    for (const [agentId, profile] of Object.entries(this.config.agent_profiles)) {
      const agent = this.createAgentInstance(agentId, profile);
      this.agents.set(agentId, agent);
      console.log(`[AgentRegistry] ✅ Registered: ${agentId} (${profile.identity})`);
    }

    console.log(`[AgentRegistry] 📦 Total agents: ${this.agents.size}\n`);
  }

  /**
   * Create agent instance based on profile
   */
  private createAgentInstance(agentId: string, profile: AgentProfile): AgentInstance {
    const capabilities = profile.capabilities || [];
    const tacticsLibrary = this.config.conversation_tactics || {};

    // Determine agent type from capabilities
    if (capabilities.includes('entity_extraction')) {
      return createAutonomousExtractionAgent(profile);
    }
    if (capabilities.includes('tool_selection')) {
      return createAutonomousMCPAgent(profile, this.config);
    }
    // Default: conversational agent
    return createAutonomousConversationalAgent(profile, tacticsLibrary);
  }

  /**
   * Get appropriate agent for goal
   * Agents declare which goals they can handle
   */
  getAgentForGoal(goalId: string): AgentInstance | null {
    const goal = this.config.goals.find(g => g.goal_id === goalId);
    if (!goal) {
      console.warn(`[AgentRegistry] ⚠️  Goal not found: ${goalId}`);
      return null;
    }

    // Find first agent that's allowed for this goal
    for (const agentId of goal.allowed_agents) {
      const agent = this.agents.get(agentId);
      if (agent) {
        console.log(`[AgentRegistry] 🎯 Selected: ${agentId} for goal ${goalId}`);
        return agent;
      }
    }

    console.warn(`[AgentRegistry] ⚠️  No agent found for goal: ${goalId}`);
    return null;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInstance | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get all agents
   */
  getAllAgents(): Map<string, AgentInstance> {
    return this.agents;
  }
}

export function createAgentRegistry(config: AgentConfigV3): AgentRegistry {
  return new AgentRegistry(config);
}
```

---

### 2.5 Integration with Orchestrator

**File**: `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`

**Changes**:

```typescript
// OLD: Node-based agent selection
if (agentProfileType === 'worker_reply_agent') {
  const replyResult = await this.workerReplyAgent.executeNode(
    state.currentNode,
    state,
    userMessage
  );
  response = replyResult.response;
}

// NEW: Goal-based agent selection with ReAct
const currentGoal = state.context.current_goal || 'UNDERSTAND_REQUEST';
const agent = this.agentRegistry.getAgentForGoal(currentGoal);

if (agent instanceof AutonomousConversationalAgent) {
  // Agent autonomously decides what to do
  const action = await agent.decide_and_act(
    currentGoal,
    state.context,
    userMessage,
    state.context.conversation.history
  );

  // Execute the decided action
  if (action.type === 'speak' || action.type === 'ask_question') {
    response = action.content;

    // Self-reflection after customer responds (next turn)
    if (previousAction) {
      const reflection = await agent.reflect_on_action(previousAction, userMessage);
      // Log reflection for improvement
    }
  }
  else if (action.type === 'use_tool') {
    // Delegate to MCP agent
    const mcpAgent = this.agentRegistry.getAgent('mcp_agent');
    // ...
  }
}
```

---

### 2.6 Benefits of Autonomous Agents

**Comparison**:

| Aspect | Old (Node-Based) | New (Autonomous) |
|--------|------------------|------------------|
| **Identity** | Changes per node | Persistent across conversation |
| **Decision-making** | Executes node instructions | Reasons about what to do |
| **Adaptability** | Fixed per node | Adapts to conversation flow |
| **Reusability** | Tied to specific nodes | Works across multiple goals |
| **Explainability** | No reasoning logged | Full reasoning trace |
| **Error handling** | Fails silently | Reasons about errors |
| **Learning** | No feedback loop | Self-reflection after actions |

---

### 2.7 Testing Autonomous Agents

**File**: `apps/api/src/modules/chat/orchestrator/__tests__/autonomous-agent.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createAutonomousConversationalAgent } from '../agents/autonomous-conversational-agent.service';

const testProfile = {
  identity: 'Test Agent',
  capabilities: ['natural_conversation', 'question_asking'],
  system_prompt: 'You are a helpful test agent.',
  personality_traits: {
    empathy_level: 'high',
    formality: 'professional_friendly',
    verbosity: 'concise'
  }
};

const testTactics = {
  empathetic_listening: {
    description: 'Acknowledge concern',
    examples: ['I understand...'],
    when_to_use: 'Customer frustrated',
    contraindications: 'Don\'t overuse'
  }
};

describe('AutonomousConversationalAgent', () => {
  const agent = createAutonomousConversationalAgent(testProfile, testTactics);

  it('should decide to ask clarifying question when customer is vague', async () => {
    const action = await agent.decide_and_act(
      'UNDERSTAND_REQUEST',
      { customers_main_ask: '', customer_phone_number: '' },
      'my roof',
      [{ customer: 'my roof', agent: '' }]
    );

    expect(action.type).toBe('ask_question');
    expect(action.content.toLowerCase()).toContain('roof');
    expect(action.reasoning).toBeTruthy();
    expect(action.confidence).toBeGreaterThan(0.5);
  });

  it('should use empathy tactic when customer is frustrated', async () => {
    const action = await agent.decide_and_act(
      'UNDERSTAND_REQUEST',
      { customers_main_ask: 'roof leaking', customer_phone_number: '' },
      'This is really frustrating! My roof is leaking everywhere!',
      [
        { customer: 'My roof is leaking!', agent: 'I see.' },
        { customer: 'This is really frustrating!', agent: '' }
      ]
    );

    expect(action.type).toBe('speak');
    expect(action.content.toLowerCase()).toMatch(/understand|sorry|frustrat/);
    expect(action.tactic_used).toBe('empathetic_listening');
  });

  it('should reflect on ineffective action', async () => {
    const action = {
      type: 'ask_question' as const,
      content: 'What is your phone number?',
      reasoning: 'Need contact info',
      confidence: 0.8
    };

    const reflection = await agent.reflect_on_action(
      action,
      'I already told you my number is 555-1234!'
    );

    expect(reflection.effective).toBe(false);
    expect(reflection.reason.toLowerCase()).toContain('repeat');
    expect(reflection.adjustment).toBeTruthy();
  });
});
```

---

### 2.8 Migration Strategy

**Week 2, Day 1-2**: Autonomous Agent Implementation
- Create `autonomous-conversational-agent.service.ts`
- Implement ReAct pattern (decide_and_act, reason, reflect)
- Write unit tests

**Week 2, Day 3**: Agent Registry
- Create `agent-registry.service.ts`
- Load agents from config
- Test agent selection for goals

**Week 2, Day 4-5**: Integration
- Update orchestrator to use autonomous agents
- Replace node-based execution with goal-based
- Migrate one goal (UNDERSTAND_REQUEST) as pilot

**Week 2, Day 6-7**: Testing & Refinement
- A/B test: Old node-based vs New autonomous
- Measure conversation quality
- Refine reasoning prompts based on results

---

**Continue to Phase 3: Goal-Oriented Planning Layer**

---

## Phase 3: Goal-Oriented Planning Layer

**Duration**: Week 3
**Complexity**: High
**Risk**: Medium-High
**Dependencies**: Phase 1, Phase 2 complete

### 3.1 Problem Statement

**Current**: Conversations follow a **fixed 5-goal sequence**:
```
UNDERSTAND_REQUEST → GATHER_REQUIREMENTS → DESIGN_SOLUTION →
EXECUTE_SOLUTION → CONFIRM_RESOLUTION
```

**Issues**:
1. **Still too rigid** - Not all conversations need all goals
2. **No dynamic planning** - Can't adapt to unexpected customer requests
3. **No composability** - Can't handle multi-issue requests (e.g., "fix my roof AND install HVAC")
4. **No parallelization** - Can't work on multiple sub-goals simultaneously

**Goal**: Add a **dynamic task planner** that generates goal graphs on-the-fly based on customer request.

---

### 3.2 Task Graph Architecture

**Concept**: Instead of a fixed goal sequence, the planner generates a **task graph** dynamically:

```
Customer Request: "My roof is leaking and I need HVAC maintenance"

Dynamic Task Graph Generated:
                    ┌─────────────────────┐
                    │ Root Goal:          │
                    │ MULTI_SERVICE       │
                    │ RESOLUTION          │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
        ┌───────▼────────┐           ┌───────▼────────┐
        │ Sub-Goal 1:    │           │ Sub-Goal 2:    │
        │ ROOF_REPAIR    │           │ HVAC_SERVICE   │
        │ REQUEST        │           │ REQUEST        │
        └───────┬────────┘           └───────┬────────┘
                │                             │
    ┌───────────┴───────────┐     ┌──────────┴─────────┐
    │                       │     │                     │
┌───▼────┐           ┌──────▼──┐  │              ┌─────▼────┐
│Gather  │           │Schedule │  │              │Schedule  │
│Roof    │──────────▶│Roof     │  └─────────────▶│HVAC      │
│Details │           │Repair   │                 │Service   │
└────────┘           └─────────┘                 └──────────┘
```

**Key Properties**:
- **Dynamic**: Graph structure adapts to request complexity
- **Parallel**: Independent sub-goals can execute simultaneously
- **Composable**: Sub-goals can be reused across different parent goals
- **Declarative**: Task dependencies defined in config

---

### 3.3 Task Planner Implementation

**File**: `apps/api/src/modules/chat/orchestrator/planning/task-planner.service.ts`

```typescript
/**
 * Dynamic Task Planner
 * Analyzes customer request and generates a task graph
 *
 * Approach:
 * 1. Parse customer request (identify primary + secondary needs)
 * 2. Match needs to service capabilities
 * 3. Generate task graph with dependencies
 * 4. Return execution plan
 */

import { getOpenAIService } from '../services/openai.service.js';
import type { AgentConfigV3 } from '../config/agent-config.schema.js';

export interface TaskNode {
  task_id: string;
  goal_id: string;
  description: string;
  dependencies: string[]; // task_ids that must complete first
  parallel_allowed: boolean;
  estimated_turns: number;
}

export interface TaskGraph {
  root_task: TaskNode;
  tasks: TaskNode[];
  execution_order: string[][]; // Array of parallel execution groups
}

export class TaskPlanner {
  private config: AgentConfigV3;

  constructor(config: AgentConfigV3) {
    this.config = config;
  }

  /**
   * Generate task graph from customer request
   */
  async plan(customerRequest: string, context: any): Promise<TaskGraph> {
    console.log(`\n🗺️  [TaskPlanner] Generating task graph for: "${customerRequest}"`);

    // 1. Analyze request complexity
    const analysis = await this.analyzeRequest(customerRequest, context);

    console.log(`[TaskPlanner] 📊 Request Analysis:`);
    console.log(`  - Primary need: ${analysis.primary_need}`);
    console.log(`  - Secondary needs: ${analysis.secondary_needs.join(', ') || 'None'}`);
    console.log(`  - Complexity: ${analysis.complexity}`);
    console.log(`  - Estimated goals: ${analysis.required_goals.length}`);

    // 2. Generate task graph
    const graph = this.buildTaskGraph(analysis);

    console.log(`[TaskPlanner] ✅ Generated task graph:`);
    console.log(`  - Total tasks: ${graph.tasks.length}`);
    console.log(`  - Execution stages: ${graph.execution_order.length}`);
    console.log(`  - Parallel tasks: ${graph.execution_order.filter(stage => stage.length > 1).length}`);

    return graph;
  }

  /**
   * Analyze customer request to identify needs
   */
  private async analyzeRequest(
    request: string,
    context: any
  ): Promise<RequestAnalysis> {
    const systemPrompt = `You are a request analysis specialist for a home services company.

Task: Analyze customer request and identify:
1. Primary service need (main issue to solve)
2. Secondary needs (additional requests mentioned)
3. Request complexity (simple, moderate, complex)
4. Required goals from available goals

Available Goals:
${this.config.goals.map(g => `- ${g.goal_id}: ${g.description}`).join('\n')}

Output JSON Schema:
{
  "primary_need": "Brief description of main issue",
  "secondary_needs": ["Array of additional needs"],
  "complexity": "simple | moderate | complex",
  "required_goals": ["Array of goal_ids needed"],
  "reasoning": "Brief explanation of your analysis"
}

Complexity Guidelines:
- simple: Single service request, straightforward (e.g., "fix my roof")
- moderate: Single service with specific requirements (e.g., "fix roof leak in bathroom, need it urgent")
- complex: Multiple services or multi-step resolution (e.g., "roof leaking AND need HVAC maintenance")
`;

    const userPrompt = `Customer Request: "${request}"

Current Context:
${JSON.stringify({
      issue: context.customers_main_ask,
      phone: context.customer_phone_number,
      history_length: context.conversation?.history?.length || 0
    }, null, 2)}

Analyze this request.`;

    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'planner',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      jsonMode: true
    });

    return JSON.parse(result.content || '{}');
  }

  /**
   * Build task graph from analysis
   */
  private buildTaskGraph(analysis: RequestAnalysis): TaskGraph {
    const tasks: TaskNode[] = [];
    let taskIdCounter = 0;

    // Create root task
    const rootTask: TaskNode = {
      task_id: `task_${taskIdCounter++}`,
      goal_id: 'ROOT',
      description: `Resolve: ${analysis.primary_need}`,
      dependencies: [],
      parallel_allowed: false,
      estimated_turns: 0
    };

    // Create tasks for each required goal
    for (const goalId of analysis.required_goals) {
      const goal = this.config.goals.find(g => g.goal_id === goalId);
      if (!goal) continue;

      const task: TaskNode = {
        task_id: `task_${taskIdCounter++}`,
        goal_id: goalId,
        description: goal.description,
        dependencies: this.determineDependencies(goalId, tasks),
        parallel_allowed: this.canRunInParallel(goalId),
        estimated_turns: goal.max_turns
      };

      tasks.push(task);
    }

    // Determine execution order (topological sort with parallelization)
    const executionOrder = this.computeExecutionOrder(tasks);

    return {
      root_task: rootTask,
      tasks,
      execution_order: executionOrder
    };
  }

  /**
   * Determine dependencies for a goal
   */
  private determineDependencies(goalId: string, existingTasks: TaskNode[]): string[] {
    // Hardcoded rules (could be LLM-powered for smarter dependencies)
    const rules: Record<string, string[]> = {
      'GATHER_REQUIREMENTS': ['UNDERSTAND_REQUEST'],
      'DESIGN_SOLUTION': ['UNDERSTAND_REQUEST', 'GATHER_REQUIREMENTS'],
      'EXECUTE_SOLUTION': ['DESIGN_SOLUTION'],
      'CONFIRM_RESOLUTION': ['EXECUTE_SOLUTION']
    };

    const requiredGoals = rules[goalId] || [];
    const dependencies: string[] = [];

    for (const requiredGoal of requiredGoals) {
      const task = existingTasks.find(t => t.goal_id === requiredGoal);
      if (task) {
        dependencies.push(task.task_id);
      }
    }

    return dependencies;
  }

  /**
   * Check if goal can run in parallel with others
   */
  private canRunInParallel(goalId: string): boolean {
    // Goals that can run in parallel (no dependencies on each other)
    const parallelGroups = [
      ['GATHER_REQUIREMENTS', 'UNDERSTAND_REQUEST'] // Can clarify while gathering data
    ];

    for (const group of parallelGroups) {
      if (group.includes(goalId)) return true;
    }

    return false;
  }

  /**
   * Compute execution order using topological sort
   * Groups independent tasks into parallel execution stages
   */
  private computeExecutionOrder(tasks: TaskNode[]): string[][] {
    const executionOrder: string[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(tasks.map(t => t.task_id));

    while (remaining.size > 0) {
      // Find tasks whose dependencies are all completed
      const readyTasks = tasks.filter(t =>
        remaining.has(t.task_id) &&
        t.dependencies.every(dep => completed.has(dep))
      );

      if (readyTasks.length === 0) {
        console.warn('[TaskPlanner] ⚠️  Circular dependency detected!');
        break;
      }

      // Group parallel-allowed tasks together
      const parallelTasks: string[] = [];
      const sequentialTasks: string[] = [];

      for (const task of readyTasks) {
        if (task.parallel_allowed) {
          parallelTasks.push(task.task_id);
        } else {
          sequentialTasks.push(task.task_id);
        }
      }

      // Add parallel group if exists
      if (parallelTasks.length > 0) {
        executionOrder.push(parallelTasks);
        parallelTasks.forEach(id => {
          completed.add(id);
          remaining.delete(id);
        });
      }

      // Add sequential tasks one by one
      for (const taskId of sequentialTasks) {
        executionOrder.push([taskId]);
        completed.add(taskId);
        remaining.delete(taskId);
      }
    }

    return executionOrder;
  }
}

interface RequestAnalysis {
  primary_need: string;
  secondary_needs: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  required_goals: string[];
  reasoning: string;
}

export function createTaskPlanner(config: AgentConfigV3): TaskPlanner {
  return new TaskPlanner(config);
}
```

---

### 3.4 Task Executor (Replaces Orchestrator)

**File**: `apps/api/src/modules/chat/orchestrator/planning/task-executor.service.ts`

```typescript
/**
 * Task Executor
 * Executes task graph generated by TaskPlanner
 * Coordinates agent execution across multiple goals
 */

import type { TaskGraph, TaskNode } from './task-planner.service.js';
import type { AgentRegistry } from '../agents/agent-registry.service.js';
import type { ConversationContext } from '../types/context.types.js';

export class TaskExecutor {
  private agentRegistry: AgentRegistry;
  private currentTaskIndex: number = 0;
  private taskResults: Map<string, any> = new Map();

  constructor(agentRegistry: AgentRegistry) {
    this.agentRegistry = agentRegistry;
  }

  /**
   * Execute task graph
   * Returns when all tasks complete or error occurs
   */
  async execute(
    graph: TaskGraph,
    context: ConversationContext,
    userMessage: string
  ): Promise<ExecutionResult> {
    console.log(`\n🚀 [TaskExecutor] Executing task graph (${graph.tasks.length} tasks)...`);

    for (let stageIndex = 0; stageIndex < graph.execution_order.length; stageIndex++) {
      const stage = graph.execution_order[stageIndex];
      console.log(`[TaskExecutor] 📍 Stage ${stageIndex + 1}/${graph.execution_order.length}: ${stage.length} task(s)`);

      if (stage.length === 1) {
        // Sequential execution
        const taskId = stage[0];
        const result = await this.executeTask(taskId, graph, context, userMessage);
        this.taskResults.set(taskId, result);

        if (!result.success) {
          console.error(`[TaskExecutor] ❌ Task ${taskId} failed: ${result.error}`);
          return {
            success: false,
            completed_tasks: Array.from(this.taskResults.keys()),
            error: result.error
          };
        }
      } else {
        // Parallel execution
        console.log(`[TaskExecutor] ⚡ Running ${stage.length} tasks in parallel...`);

        const results = await Promise.allSettled(
          stage.map(taskId => this.executeTask(taskId, graph, context, userMessage))
        );

        for (let i = 0; i < results.length; i++) {
          const taskId = stage[i];
          const result = results[i];

          if (result.status === 'fulfilled') {
            this.taskResults.set(taskId, result.value);
          } else {
            console.error(`[TaskExecutor] ❌ Task ${taskId} failed: ${result.reason}`);
            return {
              success: false,
              completed_tasks: Array.from(this.taskResults.keys()),
              error: result.reason
            };
          }
        }
      }
    }

    console.log(`[TaskExecutor] ✅ All tasks completed successfully`);

    return {
      success: true,
      completed_tasks: Array.from(this.taskResults.keys()),
      results: Array.from(this.taskResults.values())
    };
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    taskId: string,
    graph: TaskGraph,
    context: ConversationContext,
    userMessage: string
  ): Promise<TaskResult> {
    const task = graph.tasks.find(t => t.task_id === taskId);
    if (!task) {
      return { success: false, error: `Task not found: ${taskId}` };
    }

    console.log(`[TaskExecutor] 🎯 Executing task: ${taskId} (Goal: ${task.goal_id})`);

    // Get agent for this goal
    const agent = this.agentRegistry.getAgentForGoal(task.goal_id);
    if (!agent) {
      return { success: false, error: `No agent found for goal: ${task.goal_id}` };
    }

    // Execute agent (using ReAct pattern from Phase 2)
    try {
      // Assuming autonomous agent with decide_and_act method
      const action = await (agent as any).decide_and_act(
        task.goal_id,
        context,
        userMessage,
        context.conversation?.history || []
      );

      return {
        success: true,
        action,
        task_id: taskId,
        goal_id: task.goal_id
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        task_id: taskId
      };
    }
  }
}

interface ExecutionResult {
  success: boolean;
  completed_tasks: string[];
  results?: any[];
  error?: string;
}

interface TaskResult {
  success: boolean;
  action?: any;
  task_id?: string;
  goal_id?: string;
  error?: string;
}

export function createTaskExecutor(agentRegistry: AgentRegistry): TaskExecutor {
  return new TaskExecutor(agentRegistry);
}
```

---

### 3.5 Integration Flow

**Updated Orchestrator Flow**:

```typescript
// apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts

async processMessage(userMessage: string, state: AgentContextState) {
  // 1. If new conversation, generate task plan
  if (!state.context.task_graph) {
    const taskGraph = await this.taskPlanner.plan(userMessage, state.context);
    state.context.task_graph = taskGraph;
  }

  // 2. Execute next stage in task graph
  const executor = createTaskExecutor(this.agentRegistry);
  const result = await executor.execute(
    state.context.task_graph,
    state.context,
    userMessage
  );

  // 3. Check if all tasks complete
  if (result.success && result.completed_tasks.length === state.context.task_graph.tasks.length) {
    state.completed = true;
    return { response: 'All tasks completed!', state };
  }

  // 4. Return latest agent response
  const latestAction = result.results?.[result.results.length - 1];
  return {
    response: latestAction?.action?.content || '',
    state
  };
}
```

---

### 3.6 Benefits of Goal-Oriented Planning

| Aspect | Old (Fixed Goals) | New (Dynamic Planning) |
|--------|-------------------|------------------------|
| **Flexibility** | 5 fixed goals | Dynamic graph per request |
| **Multi-issue** | Can't handle | Generates sub-goals |
| **Parallelization** | Sequential only | Parallel task execution |
| **Adaptability** | Fixed sequence | Adapts to complexity |
| **Composability** | Monolithic | Reusable sub-goals |

---

### 3.7 Testing Strategy

```typescript
describe('TaskPlanner', () => {
  it('should generate simple task graph for single-issue request', async () => {
    const graph = await planner.plan('My roof is leaking', {});

    expect(graph.tasks.length).toBe(4); // UNDERSTAND, GATHER, DESIGN, EXECUTE
    expect(graph.execution_order.length).toBeGreaterThan(0);
    expect(graph.execution_order[0]).toContain('task_0'); // First task
  });

  it('should generate complex graph for multi-issue request', async () => {
    const graph = await planner.plan(
      'My roof is leaking AND I need HVAC maintenance',
      {}
    );

    expect(graph.tasks.length).toBeGreaterThan(4); // More tasks for multi-issue
    expect(graph.execution_order.some(stage => stage.length > 1)).toBe(true); // Has parallel stages
  });

  it('should respect task dependencies', async () => {
    const graph = await planner.plan('Fix my drywall', {});

    // EXECUTE_SOLUTION should depend on DESIGN_SOLUTION
    const executeTask = graph.tasks.find(t => t.goal_id === 'EXECUTE_SOLUTION');
    const designTask = graph.tasks.find(t => t.goal_id === 'DESIGN_SOLUTION');

    expect(executeTask?.dependencies).toContain(designTask?.task_id);
  });
});
```

---

**End of Phase 3. Continue to Phase 4: Context Management Optimization**

(Document continues with Phases 4-6...)
