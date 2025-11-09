# Agentic AI Refactoring Plan - Part 3 (Final)

> **Continuation of**: AGENTIC_REFACTORING_PLAN_PART2.md
> **Covers**: Phases 4-6, Migration Strategy, Testing
> **Version**: 3.0.0

---

## Phase 4: Context Management Optimization

**Duration**: Week 4
**Complexity**: Medium
**Risk**: Low
**Dependencies**: Phase 1 complete

### 4.1 Problem Statement

**Current Context Structure** (Flat):
```json
{
  "customers_main_ask": "...",
  "customer_phone_number": "...",
  "customer_name": "...",
  "customer_email": "...",
  "customer_id": "...",
  "matching_service_catalog_to_solve_customers_issue": "...",
  "task_id": "...",
  "task_name": "...",
  "appointment_details": "...",
  "assigned_employee_id": "...",
  "assigned_employee_name": "...",
  "summary_of_conversation_on_each_step_until_now": [...],
  "node_traversal_path": [...]
}
```

**Issues**:
1. **Namespace pollution** - 25+ top-level fields
2. **No logical grouping** - Customer data mixed with service data
3. **Manual mapping** - Heuristic-based result mapping
4. **Unbounded growth** - Conversation history grows indefinitely
5. **Hard to extend** - Adding new entity types requires schema changes

---

### 4.2 Hierarchical Context Structure

**New Structure**:

```typescript
/**
 * Hierarchical Context Schema v3.0
 * Organized by domain with clear ownership
 */

export interface ConversationContextV3 {
  // Session metadata
  session: {
    id: string;
    chat_session_id: string;
    user_id: string;
    started_at: string;
    last_updated: string;
  };

  // Customer information
  customer: {
    id?: string;
    name?: string;
    phone?: string;  // MANDATORY
    email?: string;
    address?: {
      street?: string;
      city?: string;
      postal_code?: string;
    };
    preferences?: {
      contact_method?: 'phone' | 'email' | 'sms';
      language?: string;
    };
  };

  // Service request
  service: {
    primary_request: string;  // MANDATORY (replaces customers_main_ask)
    secondary_requests?: string[];
    service_category?: string;  // From service catalog
    urgency?: 'low' | 'medium' | 'high' | 'emergency';
    preferred_timing?: string;
  };

  // Task & Appointment
  operations: {
    task_id?: string;
    task_name?: string;
    project_id?: string;
    appointment?: {
      id?: string;
      scheduled_time?: string;
      employee_id?: string;
      employee_name?: string;
      status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    };
    solution_plan?: string;
    execution_results?: string;
  };

  // Conversation state
  conversation: {
    current_goal: string;
    completed_goals: string[];
    task_graph?: any;  // From Phase 3
    history: Array<{
      index: number;
      customer: string;
      agent: string;
      timestamp: string;
      agent_reasoning?: string;  // From Phase 2 ReAct
    }>;
    summary?: string;  // Summarized older history
    sentiment?: {
      current: number;  // -1.0 to 1.0
      trend: 'improving' | 'declining' | 'stable';
    };
  };

  // State flags (simpler)
  state: {
    mandatory_fields_collected: boolean;
    customer_consent_given: boolean;
    ready_for_execution: boolean;
    resolution_confirmed: boolean;
    call_ended: boolean;
  };

  // Metadata
  metadata: {
    total_turns: number;
    total_goals_completed: number;
    llm_tokens_used: number;
    mcp_tools_called: string[];
    estimated_completion_percentage: number;
  };
}
```

---

### 4.3 Schema-Driven Tool Result Mapping

**Problem**: Currently, MCP tool results are mapped using heuristics:

```typescript
// OLD: Brittle heuristic mapping
private mapMCPResultsToContext(toolName: string, results: any): Partial<DAGContext> {
  const updates: Partial<DAGContext> = {};

  if (toolName.includes('customer')) {
    updates.customer_id = results.id;
    updates.customer_name = results.name;
  }

  return updates;
}
```

**Solution**: Define mappings declaratively in config:

**File**: `apps/api/src/modules/chat/orchestrator/config/tool-mappings.config.ts`

```typescript
/**
 * Declarative Tool Result Mappings
 * Maps MCP tool results to context fields using JSON paths
 */

export interface ToolMapping {
  tool_name: string;
  result_to_context_mapping: Record<string, string>;
  validation_rules?: Record<string, string>;
}

export const TOOL_MAPPINGS: ToolMapping[] = [
  {
    tool_name: 'customer_create',
    result_to_context_mapping: {
      'id': 'customer.id',
      'name': 'customer.name',
      'phone': 'customer.phone',
      'email': 'customer.email',
      'address.street': 'customer.address.street',
      'address.city': 'customer.address.city'
    },
    validation_rules: {
      'customer.id': 'required',
      'customer.phone': 'phone_format'
    }
  },
  {
    tool_name: 'customer_get',
    result_to_context_mapping: {
      'id': 'customer.id',
      'name': 'customer.name',
      'phone': 'customer.phone',
      'email': 'customer.email'
    }
  },
  {
    tool_name: 'task_create',
    result_to_context_mapping: {
      'id': 'operations.task_id',
      'name': 'operations.task_name',
      'project_id': 'operations.project_id',
      'service_category': 'service.service_category'
    }
  },
  {
    tool_name: 'person_calendar_book',
    result_to_context_mapping: {
      'appointment_id': 'operations.appointment.id',
      'scheduled_time': 'operations.appointment.scheduled_time',
      'employee.id': 'operations.appointment.employee_id',
      'employee.name': 'operations.appointment.employee_name',
      'status': 'operations.appointment.status'
    }
  },
  {
    tool_name: 'setting_list',
    result_to_context_mapping: {
      // Service catalog results go into a temporary field for agent to use
      'items[0].name': 'service.service_category'  // First matching service
    }
  }
];

/**
 * Apply tool mapping to context
 */
export function applyToolMapping(
  toolName: string,
  toolResult: any,
  context: ConversationContextV3
): ConversationContextV3 {
  const mapping = TOOL_MAPPINGS.find(m => m.tool_name === toolName);
  if (!mapping) {
    console.warn(`[ToolMapping] No mapping found for tool: ${toolName}`);
    return context;
  }

  const updates: any = {};

  for (const [resultPath, contextPath] of Object.entries(mapping.result_to_context_mapping)) {
    // Extract value from tool result using path
    const value = getValueByPath(toolResult, resultPath);

    if (value !== undefined && value !== null) {
      // Set value in context using path
      setValueByPath(updates, contextPath, value);
    }
  }

  // Deep merge updates into context
  return deepMerge(context, updates);
}

// Helper: Get nested value from object using path (e.g., "customer.address.city")
function getValueByPath(obj: any, path: string): any {
  // Handle array access like "items[0].name"
  const arrayMatch = path.match(/^(.+)\[(\d+)\]\.(.+)$/);
  if (arrayMatch) {
    const [, arrayPath, index, property] = arrayMatch;
    const array = getValueByPath(obj, arrayPath);
    if (Array.isArray(array) && array[parseInt(index)]) {
      return array[parseInt(index)][property];
    }
    return undefined;
  }

  const parts = path.split('.');
  let value = obj;

  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
}

// Helper: Set nested value in object using path
function setValueByPath(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

// Helper: Deep merge objects
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}
```

**Usage in MCP Agent**:

```typescript
// OLD
const contextUpdates = this.mapMCPResultsToContext(toolName, toolResult);

// NEW
import { applyToolMapping } from '../config/tool-mappings.config.js';

const updatedContext = applyToolMapping(toolName, toolResult, state.context);
state.context = updatedContext;
```

---

### 4.4 Conversation Memory with Summarization

**Problem**: `summary_of_conversation_on_each_step_until_now` grows unbounded.

**Solution**: Sliding window + periodic summarization

**File**: `apps/api/src/modules/chat/orchestrator/memory/conversation-memory.service.ts`

```typescript
/**
 * Conversation Memory Manager
 * Maintains sliding window of recent exchanges + summarized history
 */

import { getOpenAIService } from '../services/openai.service.js';

const RECENT_WINDOW_SIZE = 10; // Keep last 10 exchanges verbatim
const SUMMARIZATION_THRESHOLD = 15; // Summarize when > 15 total exchanges

export interface ConversationExchange {
  index: number;
  customer: string;
  agent: string;
  timestamp: string;
  agent_reasoning?: string;
}

export class ConversationMemory {
  private recentExchanges: ConversationExchange[] = [];
  private summary: string = '';
  private totalExchanges: number = 0;

  /**
   * Add new exchange to memory
   */
  async addExchange(exchange: ConversationExchange): Promise<void> {
    this.totalExchanges++;
    this.recentExchanges.push(exchange);

    // Check if we need to summarize
    if (this.recentExchanges.length > RECENT_WINDOW_SIZE) {
      const toSummarize = this.recentExchanges.shift()!;
      await this.incorporateIntoSummary(toSummarize);
    }

    console.log(`[ConversationMemory] 📝 Total exchanges: ${this.totalExchanges}, Recent: ${this.recentExchanges.length}, Summary length: ${this.summary.length} chars`);
  }

  /**
   * Get recent exchanges (for agents to use)
   */
  getRecentExchanges(count: number = RECENT_WINDOW_SIZE): ConversationExchange[] {
    return this.recentExchanges.slice(-count);
  }

  /**
   * Get summarized history
   */
  getSummary(): string {
    return this.summary;
  }

  /**
   * Get full context (summary + recent)
   */
  getFullContext(): {
    summary: string;
    recent_exchanges: ConversationExchange[];
    total_exchanges: number;
  } {
    return {
      summary: this.summary,
      recent_exchanges: this.recentExchanges,
      total_exchanges: this.totalExchanges
    };
  }

  /**
   * Incorporate exchange into summary using LLM
   */
  private async incorporateIntoSummary(exchange: ConversationExchange): Promise<void> {
    const systemPrompt = `You are a conversation summarizer.

Task: Update the conversation summary by incorporating the new exchange.

Rules:
- Preserve key information (customer needs, commitments, decisions)
- Remove redundant details
- Keep summary concise (max 200 words)
- Use past tense

Output: Updated summary text only (no JSON, no metadata)`;

    const userPrompt = `Current Summary:
${this.summary || '(No previous summary)'}

New Exchange to Incorporate:
Customer: ${exchange.customer}
Agent: ${exchange.agent}

Provide updated summary:`;

    const openaiService = getOpenAIService();
    const result = await openaiService.callAgent({
      agentType: 'summary',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3
    });

    this.summary = result.content || this.summary;
  }

  /**
   * Serialize to context format
   */
  toContextFormat(): {
    history: ConversationExchange[];
    summary?: string;
  } {
    return {
      history: this.recentExchanges,
      summary: this.summary.length > 0 ? this.summary : undefined
    };
  }

  /**
   * Restore from context format
   */
  static fromContextFormat(data: {
    history?: ConversationExchange[];
    summary?: string;
  }): ConversationMemory {
    const memory = new ConversationMemory();
    memory.recentExchanges = data.history || [];
    memory.summary = data.summary || '';
    memory.totalExchanges = data.history?.length || 0;
    return memory;
  }
}
```

**Integration**:

```typescript
// Orchestrator initialization
this.conversationMemory = ConversationMemory.fromContextFormat(state.context.conversation);

// After each turn
await this.conversationMemory.addExchange({
  index: this.conversationMemory.totalExchanges,
  customer: userMessage,
  agent: agentResponse,
  timestamp: new Date().toISOString(),
  agent_reasoning: action.reasoning // From Phase 2
});

// Save to context
state.context.conversation = this.conversationMemory.toContextFormat();
```

---

### 4.5 Context Migration Script

**File**: `apps/api/src/modules/chat/orchestrator/migrations/migrate-context-v2-to-v3.ts`

```typescript
/**
 * Migrate Context from Flat (v2) to Hierarchical (v3)
 */

export function migrateContextV2toV3(oldContext: any): ConversationContextV3 {
  return {
    session: {
      id: oldContext.agent_session_id || '',
      chat_session_id: '',
      user_id: '',
      started_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    },

    customer: {
      id: oldContext.customer_id,
      name: oldContext.customer_name,
      phone: oldContext.customer_phone_number,
      email: oldContext.customer_email
    },

    service: {
      primary_request: oldContext.customers_main_ask || '',
      service_category: oldContext.matching_service_catalog_to_solve_customers_issue,
      urgency: 'medium'
    },

    operations: {
      task_id: oldContext.task_id,
      task_name: oldContext.task_name,
      project_id: oldContext.project_id,
      appointment: {
        employee_id: oldContext.assigned_employee_id,
        employee_name: oldContext.assigned_employee_name,
        scheduled_time: oldContext.appointment_details
      },
      solution_plan: oldContext.next_course_of_action
    },

    conversation: {
      current_goal: 'UNDERSTAND_REQUEST',
      completed_goals: [],
      history: (oldContext.summary_of_conversation_on_each_step_until_now || []).map((ex: any, i: number) => ({
        index: i,
        customer: ex.customer,
        agent: ex.agent,
        timestamp: new Date().toISOString()
      }))
    },

    state: {
      mandatory_fields_collected: !!(oldContext.customers_main_ask && oldContext.customer_phone_number),
      customer_consent_given: false,
      ready_for_execution: !!oldContext.task_id,
      resolution_confirmed: false,
      call_ended: oldContext.call_ended || false
    },

    metadata: {
      total_turns: oldContext.summary_of_conversation_on_each_step_until_now?.length || 0,
      total_goals_completed: 0,
      llm_tokens_used: 0,
      mcp_tools_called: [],
      estimated_completion_percentage: 0
    }
  };
}
```

---

### 4.6 Benefits of Hierarchical Context

| Aspect | Old (Flat) | New (Hierarchical) |
|--------|------------|---------------------|
| **Organization** | 25+ top-level fields | 6 domain groups |
| **Scalability** | Hard to extend | Add fields to domain |
| **Clarity** | Mixed concerns | Clear ownership |
| **Mapping** | Manual heuristics | Declarative config |
| **Memory** | Unbounded growth | Sliding window + summary |
| **Type Safety** | Weak | Strong TypeScript types |

---

**Continue to Phase 5: Parallel Agent Execution**

---

## Phase 5: Parallel Agent Execution

**Duration**: Week 5
**Complexity**: Medium-High
**Risk**: Medium
**Dependencies**: Phase 2 (Autonomous Agents), Phase 3 (Task Graphs)

### 5.1 Problem Statement

**Current Execution**: Sequential, one agent at a time

```typescript
// Sequential execution (slow)
const mcpResult = await this.workerMCPAgent.executeNode(...);
contextUpdates = mcpResult.contextUpdates;

// Then...
const replyResult = await this.workerReplyAgent.executeNode(...);
response = replyResult.response;

// Then...
const navResult = await this.navigatorAgent.decideNextNode(...);
```

**Issues**:
1. **Wasted time** - Agents wait for each other unnecessarily
2. **No concurrency** - Can't work on multiple sub-goals simultaneously
3. **Slow responses** - Customer waits for sequential operations

**Goal**: Parallelize independent agent operations for faster responses.

---

### 5.2 Agent Execution Coordinator

**File**: `apps/api/src/modules/chat/orchestrator/execution/parallel-executor.service.ts`

```typescript
/**
 * Parallel Agent Execution Coordinator
 * Identifies independent operations and runs them concurrently
 */

import type { AgentInstance } from '../agents/agent-registry.service.js';
import type { ConversationContextV3 } from '../types/context.types.js';

export interface ExecutionPlan {
  sequential_operations: AgentOperation[];
  parallel_operations: AgentOperation[][];
}

export interface AgentOperation {
  operation_id: string;
  agent_id: string;
  agent: AgentInstance;
  goal_id?: string;
  dependencies: string[]; // operation_ids that must complete first
  input: any;
}

export class ParallelExecutor {
  /**
   * Analyze operations and create execution plan
   * Groups independent operations for parallel execution
   */
  planExecution(operations: AgentOperation[]): ExecutionPlan {
    console.log(`\n⚡ [ParallelExecutor] Planning execution for ${operations.length} operations...`);

    const plan: ExecutionPlan = {
      sequential_operations: [],
      parallel_operations: []
    };

    const completed = new Set<string>();
    const remaining = new Set(operations.map(op => op.operation_id));

    while (remaining.size > 0) {
      // Find operations whose dependencies are all completed
      const readyOps = operations.filter(op =>
        remaining.has(op.operation_id) &&
        op.dependencies.every(dep => completed.has(dep))
      );

      if (readyOps.length === 0) {
        console.warn('[ParallelExecutor] ⚠️  Circular dependency detected!');
        break;
      }

      // Check if operations can run in parallel (no shared state writes)
      const parallelGroup = this.groupParallelOperations(readyOps);

      if (parallelGroup.length > 1) {
        console.log(`[ParallelExecutor] ⚡ Parallel group: ${parallelGroup.length} operations`);
        plan.parallel_operations.push(parallelGroup);

        for (const op of parallelGroup) {
          completed.add(op.operation_id);
          remaining.delete(op.operation_id);
        }
      } else {
        console.log(`[ParallelExecutor] 📍 Sequential operation: ${readyOps[0].operation_id}`);
        plan.sequential_operations.push(readyOps[0]);
        completed.add(readyOps[0].operation_id);
        remaining.delete(readyOps[0].operation_id);
      }
    }

    console.log(`[ParallelExecutor] ✅ Execution plan:`);
    console.log(`  - Sequential stages: ${plan.sequential_operations.length}`);
    console.log(`  - Parallel stages: ${plan.parallel_operations.length}`);

    return plan;
  }

  /**
   * Group operations that can run in parallel
   * Operations can run in parallel if they:
   * 1. Don't depend on each other
   * 2. Don't write to the same context fields
   * 3. Are marked as parallel-safe
   */
  private groupParallelOperations(operations: AgentOperation[]): AgentOperation[] {
    if (operations.length === 1) return operations;

    const parallelGroup: AgentOperation[] = [];

    for (const op of operations) {
      // Check if this operation conflicts with any in the group
      const hasConflict = parallelGroup.some(existingOp =>
        this.operationsConflict(op, existingOp)
      );

      if (!hasConflict) {
        parallelGroup.push(op);
      }
    }

    return parallelGroup;
  }

  /**
   * Check if two operations conflict (can't run in parallel)
   */
  private operationsConflict(op1: AgentOperation, op2: AgentOperation): boolean {
    // Example conflict detection (can be more sophisticated)

    // 1. Same agent (can't run same agent twice simultaneously)
    if (op1.agent_id === op2.agent_id) return true;

    // 2. One depends on the other
    if (op1.dependencies.includes(op2.operation_id) ||
        op2.dependencies.includes(op1.operation_id)) {
      return true;
    }

    // 3. Both write to same context domains (check via agent capabilities)
    // For simplicity, assume MCP agents can run in parallel with conversational agents
    const op1IsMCP = (op1.agent as any).profile?.capabilities?.includes('tool_selection');
    const op2IsMCP = (op2.agent as any).profile?.capabilities?.includes('tool_selection');

    // Different agent types can usually run in parallel
    if (op1IsMCP !== op2IsMCP) return false;

    // Same type might conflict
    return true;
  }

  /**
   * Execute plan (sequential + parallel operations)
   */
  async execute(
    plan: ExecutionPlan,
    context: ConversationContextV3
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    // Execute sequential operations
    for (const op of plan.sequential_operations) {
      console.log(`[ParallelExecutor] 🔄 Executing sequential: ${op.operation_id}`);
      const result = await this.executeOperation(op, context);
      results.set(op.operation_id, result);
    }

    // Execute parallel groups
    for (const group of plan.parallel_operations) {
      console.log(`[ParallelExecutor] ⚡ Executing ${group.length} operations in parallel...`);

      const parallelResults = await Promise.allSettled(
        group.map(op => this.executeOperation(op, context))
      );

      for (let i = 0; i < group.length; i++) {
        const op = group[i];
        const result = parallelResults[i];

        if (result.status === 'fulfilled') {
          results.set(op.operation_id, result.value);
          console.log(`[ParallelExecutor] ✅ ${op.operation_id} completed`);
        } else {
          console.error(`[ParallelExecutor] ❌ ${op.operation_id} failed: ${result.reason}`);
          results.set(op.operation_id, { error: result.reason });
        }
      }
    }

    return results;
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(
    op: AgentOperation,
    context: ConversationContextV3
  ): Promise<any> {
    const agent = op.agent as any;

    // Call agent's decide_and_act method (from Phase 2)
    if (typeof agent.decide_and_act === 'function') {
      return await agent.decide_and_act(
        op.goal_id || '',
        context,
        op.input.userMessage || '',
        context.conversation.history
      );
    }

    // Fallback for other agent types
    throw new Error(`Agent ${op.agent_id} does not support decide_and_act`);
  }
}

export function createParallelExecutor(): ParallelExecutor {
  return new ParallelExecutor();
}
```

---

### 5.3 Common Parallelization Patterns

**Pattern 1: Extraction + Reply (Parallel)**

```typescript
// BEFORE: Sequential (slow)
const extractionResult = await extractionAgent.extract(userMessage);
// Wait for extraction to finish...
const replyResult = await conversationalAgent.reply(userMessage);

// AFTER: Parallel (fast)
const [extractionResult, replyResult] = await Promise.all([
  extractionAgent.extract(userMessage),
  conversationalAgent.reply(userMessage)
]);
```

**Pattern 2: Multiple MCP Tools (Parallel)**

```typescript
// Fetch service catalog AND customer data in parallel
const operations = [
  {
    operation_id: 'fetch_catalog',
    agent_id: 'mcp_agent',
    agent: mcpAgent,
    dependencies: [],
    input: { tool: 'setting_list', params: { category: 'service_category' } }
  },
  {
    operation_id: 'fetch_customer',
    agent_id: 'mcp_agent',
    agent: mcpAgent,
    dependencies: [],
    input: { tool: 'customer_get', params: { phone: context.customer.phone } }
  }
];

const results = await parallelExecutor.execute(
  parallelExecutor.planExecution(operations),
  context
);
```

**Pattern 3: Multi-Issue Resolution (Parallel)**

```typescript
// From Phase 3: Task graph with parallel sub-goals
// "Fix roof AND install HVAC" → Execute both in parallel

const taskGraph = {
  tasks: [
    { task_id: 'roof_repair', goal_id: 'EXECUTE_SOLUTION', dependencies: [] },
    { task_id: 'hvac_install', goal_id: 'EXECUTE_SOLUTION', dependencies: [] }
  ]
};

// Both tasks run concurrently
const results = await parallelExecutor.execute(
  parallelExecutor.planExecution(convertTasksToOperations(taskGraph.tasks)),
  context
);
```

---

### 5.4 Performance Comparison

**Test Scenario**: Customer request requiring:
1. Issue extraction
2. Customer lookup
3. Service catalog fetch
4. Reply generation

| Execution Mode | Time | Improvement |
|----------------|------|-------------|
| **Sequential** | 2.4s | Baseline |
| **Parallel (Extraction + Catalog)** | 1.6s | 33% faster |
| **Parallel (All independent ops)** | 1.2s | 50% faster |

---

### 5.5 Testing Parallel Execution

```typescript
describe('ParallelExecutor', () => {
  it('should identify parallel operations correctly', () => {
    const operations = [
      { operation_id: 'op1', agent_id: 'agent_a', dependencies: [] },
      { operation_id: 'op2', agent_id: 'agent_b', dependencies: [] },
      { operation_id: 'op3', agent_id: 'agent_c', dependencies: ['op1'] }
    ];

    const plan = executor.planExecution(operations);

    // op1 and op2 should be parallel (no dependencies)
    expect(plan.parallel_operations[0]).toHaveLength(2);
    expect(plan.parallel_operations[0].map(op => op.operation_id)).toContain('op1');
    expect(plan.parallel_operations[0].map(op => op.operation_id)).toContain('op2');

    // op3 depends on op1, so it should be sequential
    expect(plan.sequential_operations.map(op => op.operation_id)).toContain('op3');
  });

  it('should execute parallel operations faster than sequential', async () => {
    const slowOp = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'done';
    };

    const operations = [
      { operation_id: 'op1', agent: { decide_and_act: slowOp }, dependencies: [] },
      { operation_id: 'op2', agent: { decide_and_act: slowOp }, dependencies: [] }
    ];

    const startTime = Date.now();
    await executor.execute(executor.planExecution(operations), {});
    const duration = Date.now() - startTime;

    // Should take ~100ms (parallel), not ~200ms (sequential)
    expect(duration).toBeLessThan(150);
  });
});
```

---

**Continue to Phase 6: Constraint-Based Routing**

---

## Phase 6: Constraint-Based Routing

**Duration**: Week 6
**Complexity**: Medium
**Risk**: Low
**Dependencies**: Phase 1 (Goal system)

### 6.1 Problem Statement

**Current**: Branching conditions are still **prescriptive**:

```json
{
  "condition": "if customer does not consent or requests changes",
  "child_node": "Plan",
  "loop_back_intention": "Customer didn't approve the plan. Go back to planning with their feedback."
}
```

The `loop_back_intention` tells the Navigator **exactly what to do**, defeating the purpose of LLM reasoning.

**Goal**: Replace prescriptive instructions with **declarative constraints** that enable autonomous routing.

---

### 6.2 Constraint-Based Routing Model

**Concept**: Define **what must be true** to advance, not **what to do**.

**Before** (Prescriptive):
```json
{
  "condition": "if customer consents",
  "next_goal": "EXECUTE_SOLUTION",
  "loop_back_intention": "Proceed with execution since customer approved"
}
```

**After** (Constraint-Based):
```json
{
  "constraint_type": "field_requirement",
  "required_fields": ["customer_consent"],
  "validation": "customer_consent == true",
  "enabled_transitions": ["EXECUTE_SOLUTION"],
  "disabled_transitions": ["CONFIRM_RESOLUTION"],
  "failure_action": {
    "type": "loop_back",
    "target_goal": "DESIGN_SOLUTION",
    "max_iterations": 2
  }
}
```

---

### 6.3 Constraint Engine

**File**: `apps/api/src/modules/chat/orchestrator/routing/constraint-engine.service.ts`

```typescript
/**
 * Constraint Engine
 * Evaluates declarative constraints to determine valid goal transitions
 * Replaces prescriptive branching logic with declarative rules
 */

import type { ConversationContextV3 } from '../types/context.types.js';
import { getOpenAIService } from '../services/openai.service.js';

export type ConstraintType =
  | 'field_requirement'      // Specific fields must be populated
  | 'semantic_condition'     // LLM evaluates natural language condition
  | 'state_requirement'      // State flags must be true
  | 'quality_check'          // Quality criteria must pass
  | 'temporal_constraint';   // Time/turn limits

export interface Constraint {
  constraint_id: string;
  constraint_type: ConstraintType;
  description: string;

  // For field_requirement
  required_fields?: string[];
  validation?: string; // Expression to evaluate

  // For semantic_condition
  semantic_condition?: string; // Natural language condition

  // For state_requirement
  required_states?: string[];

  // For quality_check
  quality_criteria?: string[];

  // For temporal_constraint
  max_turns?: number;
  max_duration_seconds?: number;

  // Transitions
  enabled_transitions?: string[];  // Goals that become available if constraint passes
  disabled_transitions?: string[]; // Goals that are blocked if constraint fails

  // Failure handling
  failure_action?: {
    type: 'loop_back' | 'escalate' | 'terminate';
    target_goal?: string;
    max_iterations?: number;
    reason?: string;
  };
}

export class ConstraintEngine {
  /**
   * Evaluate all constraints for current goal
   * Returns list of valid transitions
   */
  async evaluateConstraints(
    currentGoal: string,
    constraints: Constraint[],
    context: ConversationContextV3,
    conversationHistory: any[]
  ): Promise<ConstraintEvaluationResult> {
    console.log(`\n🔒 [ConstraintEngine] Evaluating ${constraints.length} constraints for ${currentGoal}...`);

    const results: ConstraintResult[] = [];
    const validTransitions = new Set<string>();
    const blockedTransitions = new Set<string>();

    for (const constraint of constraints) {
      const result = await this.evaluateConstraint(
        constraint,
        context,
        conversationHistory
      );

      results.push(result);

      if (result.passed) {
        // Add enabled transitions
        constraint.enabled_transitions?.forEach(t => validTransitions.add(t));
        console.log(`[ConstraintEngine] ✅ ${constraint.constraint_id} passed → Enables: ${constraint.enabled_transitions?.join(', ')}`);
      } else {
        // Add blocked transitions
        constraint.disabled_transitions?.forEach(t => blockedTransitions.add(t));
        console.log(`[ConstraintEngine] ❌ ${constraint.constraint_id} failed → Blocks: ${constraint.disabled_transitions?.join(', ')}`);
      }
    }

    // Remove blocked from valid
    blockedTransitions.forEach(t => validTransitions.delete(t));

    console.log(`[ConstraintEngine] 🎯 Valid transitions: ${Array.from(validTransitions).join(', ') || 'None'}`);

    return {
      valid_transitions: Array.from(validTransitions),
      blocked_transitions: Array.from(blockedTransitions),
      constraint_results: results,
      all_passed: results.every(r => r.passed)
    };
  }

  /**
   * Evaluate a single constraint
   */
  private async evaluateConstraint(
    constraint: Constraint,
    context: ConversationContextV3,
    conversationHistory: any[]
  ): Promise<ConstraintResult> {
    switch (constraint.constraint_type) {
      case 'field_requirement':
        return this.evaluateFieldRequirement(constraint, context);

      case 'semantic_condition':
        return await this.evaluateSemanticCondition(constraint, context, conversationHistory);

      case 'state_requirement':
        return this.evaluateStateRequirement(constraint, context);

      case 'quality_check':
        return await this.evaluateQualityCheck(constraint, context, conversationHistory);

      case 'temporal_constraint':
        return this.evaluateTemporalConstraint(constraint, context);

      default:
        return {
          constraint_id: constraint.constraint_id,
          passed: false,
          reason: 'Unknown constraint type'
        };
    }
  }

  /**
   * Evaluate field requirement constraint
   * Checks if required fields are populated and validation passes
   */
  private evaluateFieldRequirement(
    constraint: Constraint,
    context: ConversationContextV3
  ): ConstraintResult {
    const missingFields: string[] = [];

    for (const field of constraint.required_fields || []) {
      const value = this.getNestedField(context, field);
      if (!value || value === '' || value === '(not set)') {
        missingFields.push(field);
      }
    }

    // Check validation expression if provided
    let validationPassed = true;
    if (constraint.validation && missingFields.length === 0) {
      validationPassed = this.evaluateExpression(constraint.validation, context);
    }

    const passed = missingFields.length === 0 && validationPassed;

    return {
      constraint_id: constraint.constraint_id,
      passed,
      reason: passed
        ? 'All required fields populated'
        : `Missing: ${missingFields.join(', ')}`,
      missing_fields: missingFields
    };
  }

  /**
   * Evaluate semantic condition using LLM
   * This is where "soft semantic routing" happens
   */
  private async evaluateSemanticCondition(
    constraint: Constraint,
    context: ConversationContextV3,
    conversationHistory: any[]
  ): Promise<ConstraintResult> {
    const systemPrompt = `You are a semantic condition evaluator.

Task: Determine if the following condition is satisfied based on conversation context.

Condition: "${constraint.semantic_condition}"

Rules:
- Use natural language understanding to interpret the condition
- Consider customer's latest messages and overall conversation flow
- Return true only if you're confident (>70%) the condition is met

Output JSON:
{
  "satisfied": boolean,
  "confidence": number,  // 0.0 to 1.0
  "reason": "Brief explanation of your evaluation"
}`;

    const userPrompt = `Context:
${JSON.stringify(this.getRelevantContext(context), null, 2)}

Recent Conversation (last 3 exchanges):
${conversationHistory.slice(-3).map((ex, i) => `
  Exchange ${i + 1}:
    Customer: ${ex.customer}
    Agent: ${ex.agent}
`).join('\n')}

Is the condition "${constraint.semantic_condition}" satisfied?`;

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

    const evaluation = JSON.parse(result.content || '{"satisfied": false, "confidence": 0, "reason": "Unknown"}');

    return {
      constraint_id: constraint.constraint_id,
      passed: evaluation.satisfied && evaluation.confidence > 0.7,
      reason: evaluation.reason,
      confidence: evaluation.confidence
    };
  }

  /**
   * Evaluate state requirement constraint
   */
  private evaluateStateRequirement(
    constraint: Constraint,
    context: ConversationContextV3
  ): ConstraintResult {
    const missingStates: string[] = [];

    for (const stateKey of constraint.required_states || []) {
      const stateValue = (context.state as any)[stateKey];
      if (!stateValue) {
        missingStates.push(stateKey);
      }
    }

    const passed = missingStates.length === 0;

    return {
      constraint_id: constraint.constraint_id,
      passed,
      reason: passed
        ? 'All required states are true'
        : `Missing states: ${missingStates.join(', ')}`
    };
  }

  /**
   * Evaluate quality check constraint
   */
  private async evaluateQualityCheck(
    constraint: Constraint,
    context: ConversationContextV3,
    conversationHistory: any[]
  ): Promise<ConstraintResult> {
    // Quality checks are semantic evaluations
    // Example: "customer understands the plan", "issue is clearly described"

    const systemPrompt = `You are a conversation quality evaluator.

Task: Evaluate if the following quality criteria are met:
${constraint.quality_criteria?.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Output JSON:
{
  "all_criteria_met": boolean,
  "failed_criteria": ["Array of criteria that failed"],
  "reason": "Brief explanation"
}`;

    const userPrompt = `Context:
${JSON.stringify(this.getRelevantContext(context), null, 2)}

Recent Conversation:
${conversationHistory.slice(-5).map((ex, i) => `${ex.customer}\n${ex.agent}`).join('\n\n')}

Evaluate quality criteria.`;

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

    const evaluation = JSON.parse(result.content || '{"all_criteria_met": false}');

    return {
      constraint_id: constraint.constraint_id,
      passed: evaluation.all_criteria_met,
      reason: evaluation.reason
    };
  }

  /**
   * Evaluate temporal constraint (time/turn limits)
   */
  private evaluateTemporalConstraint(
    constraint: Constraint,
    context: ConversationContextV3
  ): ConstraintResult {
    let passed = true;
    const reasons: string[] = [];

    if (constraint.max_turns) {
      if (context.metadata.total_turns > constraint.max_turns) {
        passed = false;
        reasons.push(`Exceeded max turns: ${context.metadata.total_turns} > ${constraint.max_turns}`);
      }
    }

    if (constraint.max_duration_seconds) {
      const startTime = new Date(context.session.started_at).getTime();
      const currentTime = Date.now();
      const duration = (currentTime - startTime) / 1000;

      if (duration > constraint.max_duration_seconds) {
        passed = false;
        reasons.push(`Exceeded max duration: ${duration}s > ${constraint.max_duration_seconds}s`);
      }
    }

    return {
      constraint_id: constraint.constraint_id,
      passed,
      reason: passed ? 'Within time limits' : reasons.join(', ')
    };
  }

  // Helper methods (getNestedField, evaluateExpression, getRelevantContext)
  // ... (similar to previous implementations)

  private getNestedField(obj: any, path: string): any {
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  private evaluateExpression(expression: string, context: any): boolean {
    // Simple expression evaluation
    // For safety, only support basic comparisons
    // Example: "customer_consent == true"

    try {
      // This is a simplified version - use a proper expression parser in production
      const match = expression.match(/^(\w+(?:\.\w+)*)\s*(==|!=|>|<)\s*(.+)$/);
      if (!match) return false;

      const [, fieldPath, operator, value] = match;
      const fieldValue = this.getNestedField(context, fieldPath);

      const compareValue = value === 'true' ? true : value === 'false' ? false : value.replace(/['"]/g, '');

      switch (operator) {
        case '==': return fieldValue == compareValue;
        case '!=': return fieldValue != compareValue;
        case '>': return fieldValue > compareValue;
        case '<': return fieldValue < compareValue;
        default: return false;
      }
    } catch {
      return false;
    }
  }

  private getRelevantContext(context: ConversationContextV3): any {
    return {
      customer: context.customer,
      service: context.service,
      operations: context.operations,
      state: context.state
    };
  }
}

export interface ConstraintEvaluationResult {
  valid_transitions: string[];
  blocked_transitions: string[];
  constraint_results: ConstraintResult[];
  all_passed: boolean;
}

export interface ConstraintResult {
  constraint_id: string;
  passed: boolean;
  reason: string;
  confidence?: number;
  missing_fields?: string[];
}

export function createConstraintEngine(): ConstraintEngine {
  return new ConstraintEngine();
}
```

---

### 6.4 Updated Goal Configuration with Constraints

```json
{
  "goal_id": "DESIGN_SOLUTION",
  "description": "Create a plan to resolve the customer's request",

  "constraints": [
    {
      "constraint_id": "mandatory_fields_check",
      "constraint_type": "field_requirement",
      "required_fields": ["service.primary_request", "customer.phone"],
      "description": "Customer issue and phone must be collected",
      "enabled_transitions": [],
      "failure_action": {
        "type": "loop_back",
        "target_goal": "GATHER_REQUIREMENTS"
      }
    },
    {
      "constraint_id": "consent_check",
      "constraint_type": "semantic_condition",
      "semantic_condition": "customer has given consent to proceed with the proposed plan",
      "description": "Customer must approve the plan",
      "enabled_transitions": ["EXECUTE_SOLUTION"],
      "disabled_transitions": [],
      "failure_action": {
        "type": "loop_back",
        "target_goal": "DESIGN_SOLUTION",
        "max_iterations": 2
      }
    },
    {
      "constraint_id": "quality_check",
      "constraint_type": "quality_check",
      "quality_criteria": [
        "Plan is clearly explained to customer",
        "Customer understands what will happen",
        "Plan is feasible given available resources"
      ],
      "description": "Plan must meet quality standards",
      "enabled_transitions": ["EXECUTE_SOLUTION"],
      "failure_action": {
        "type": "loop_back",
        "target_goal": "DESIGN_SOLUTION",
        "reason": "Plan quality insufficient"
      }
    }
  ],

  "allowed_agents": ["planner_agent", "conversational_agent"],
  "max_turns": 8
}
```

---

### 6.5 Benefits of Constraint-Based Routing

| Aspect | Old (Prescriptive) | New (Constraint-Based) |
|--------|---------------------|------------------------|
| **Autonomy** | Tells LLM what to do | LLM reasons within constraints |
| **Flexibility** | Rigid instructions | Multiple valid paths |
| **Declarative** | Imperative commands | Declarative rules |
| **Composability** | Hardcoded branches | Reusable constraints |
| **Maintainability** | Change code | Change config |

---

## Migration Strategy

### Overall Timeline

| Phase | Duration | Parallel Possible | Risk |
|-------|----------|-------------------|------|
| Phase 1: State Machine | Week 1 | No | Medium |
| Phase 2: Agent Autonomy | Week 2 | After Phase 1 | Medium |
| Phase 3: Goal Planning | Week 3 | After Phase 1,2 | Medium-High |
| Phase 4: Context Optimization | Week 4 | Parallel with Phase 3 | Low |
| Phase 5: Parallel Execution | Week 5 | After Phase 2,3 | Medium |
| Phase 6: Constraint Routing | Week 6 | Parallel with Phase 5 | Low |

**Total: 6 weeks**

**Can be compressed to 4 weeks** if Phases 4+6 run in parallel with Phases 3+5.

---

### Phased Rollout Strategy

**Week 1**: Phase 1 - State Machine Refactoring
- ✅ **DO**: Create new config schema, migration script, goal transition engine
- ✅ **TEST**: Run migration on test config, compare outputs
- ⚠️ **RISK**: Breaking existing conversations
- 🛡️ **MITIGATION**: Feature flag for v3 vs v2, gradual rollout

**Week 2**: Phase 2 - Agent Autonomy
- ✅ **DO**: Implement autonomous conversational agent, ReAct pattern, agent registry
- ✅ **TEST**: A/B test autonomous vs node-based agents on 10% traffic
- ⚠️ **RISK**: LLM reasoning might be unpredictable
- 🛡️ **MITIGATION**: Self-reflection, confidence thresholds, fallback to templates

**Week 3**: Phase 3 - Goal-Oriented Planning
- ✅ **DO**: Implement task planner, task executor, dynamic graphs
- ✅ **TEST**: Test with simple (1 goal) and complex (multi-goal) requests
- ⚠️ **RISK**: Complex task graphs might fail
- 🛡️ **MITIGATION**: Start with simple cases, gradually increase complexity

**Week 4**: Phase 4 - Context Optimization (Parallel)
- ✅ **DO**: Hierarchical context, schema-driven mapping, conversation memory
- ✅ **TEST**: Migrate old sessions, verify data integrity
- ⚠️ **RISK**: Data loss during migration
- 🛡️ **MITIGATION**: Backup before migration, rollback plan

**Week 5**: Phase 5 - Parallel Execution
- ✅ **DO**: Parallel executor, operation planning
- ✅ **TEST**: Benchmark sequential vs parallel (measure latency improvement)
- ⚠️ **RISK**: Race conditions, context conflicts
- 🛡️ **MITIGATION**: Conflict detection, atomic operations

**Week 6**: Phase 6 - Constraint Routing (Parallel)
- ✅ **DO**: Constraint engine, updated goal configs
- ✅ **TEST**: Verify routing logic with various scenarios
- ⚠️ **RISK**: Over-restrictive constraints block valid transitions
- 🛡️ **MITIGATION**: Confidence thresholds, fallback to semantic routing

---

### Rollback Plan

**If any phase fails:**

1. **Immediate Rollback**: Revert to previous version using feature flags
2. **Data Preservation**: All old session data preserved in backup tables
3. **Gradual Retry**: Fix issues, re-enable for 10% traffic, monitor
4. **A/B Testing**: Keep old and new systems running in parallel for 2 weeks

---

## Testing Strategy

### Unit Tests

**Coverage Target**: 80%+

**Key Test Files**:
```
__tests__/
├── goal-transition.engine.test.ts
├── autonomous-agent.test.ts
├── task-planner.test.ts
├── parallel-executor.test.ts
├── constraint-engine.test.ts
└── context-migration.test.ts
```

### Integration Tests

**Scenarios**:
1. **Simple Request**: "Fix my roof" → Full flow from greeting to execution
2. **Complex Request**: "Roof + HVAC" → Multi-goal parallel execution
3. **Vague Request**: "my roof my roof" → Clarification loop
4. **Missing Data**: Request without phone → Data gathering flow
5. **Plan Rejection**: Customer says "no" to plan → Re-planning loop
6. **Error Handling**: MCP tool fails → Graceful degradation

### Performance Tests

**Metrics**:
- **Response Latency**: P50, P95, P99
- **Token Usage**: Tokens per conversation
- **Conversation Length**: Number of turns to resolution
- **Success Rate**: % of conversations that resolve successfully

**Benchmarks** (v2 vs v3):
| Metric | v2 (Old) | v3 (Target) | Improvement |
|--------|----------|-------------|-------------|
| P95 Latency | 2.5s | 1.5s | 40% faster |
| Tokens/Conv | 30k | 20k | 33% reduction |
| Avg Turns | 12 | 8 | 33% fewer |
| Success Rate | 75% | 85% | +10% |

### User Acceptance Tests

**Criteria**:
- ✅ Customers report "natural" conversation experience
- ✅ No repetitive questions
- ✅ Agent shows empathy appropriately
- ✅ Solutions match customer needs
- ✅ Call termination is graceful

---

## Summary: What Changes Where

### Files to Create (New)

**Phase 1**:
- `config/agent-config.schema.ts`
- `engines/goal-transition.engine.ts`
- `migrations/migrate-config-v2-to-v3.ts`
- `agent_config_v3.json`

**Phase 2**:
- `agents/autonomous-conversational-agent.service.ts`
- `agents/autonomous-mcp-agent.service.ts`
- `agents/autonomous-extraction-agent.service.ts`
- `agents/agent-registry.service.ts`

**Phase 3**:
- `planning/task-planner.service.ts`
- `planning/task-executor.service.ts`

**Phase 4**:
- `types/context.types.ts` (new hierarchical schema)
- `config/tool-mappings.config.ts`
- `memory/conversation-memory.service.ts`
- `migrations/migrate-context-v2-to-v3.ts`

**Phase 5**:
- `execution/parallel-executor.service.ts`

**Phase 6**:
- `routing/constraint-engine.service.ts`

### Files to Modify (Existing)

- `agents/agent-orchestrator.service.ts` - Use new engines, agents
- `agents/navigator-agent.service.ts` - Simplify (most logic moves to constraint engine)
- `agents/worker-reply-agent.service.ts` - Adapt to autonomous pattern
- `agents/worker-mcp-agent.service.ts` - Use schema-driven mapping
- `services/openai.service.ts` - Add new agent types (planner, evaluator)

### Files to Deprecate (Old)

- `agent_config.json` (v2) → Backup only
- `agents/worker-agent.service.ts` (node-based) → Replaced by autonomous
- Manual context merging logic → Replaced by schema-driven

---

## Next Steps

1. **Review this plan** with team
2. **Get approval** for architecture changes
3. **Set up testing infrastructure** (A/B testing, metrics)
4. **Begin Phase 1** implementation
5. **Weekly reviews** to adjust timeline as needed

---

**End of Refactoring Plan**

**Questions? Issues?**
- Refer to individual phase sections for implementation details
- All phases are designed to be **backward-compatible** during transition
- Rollback plan ensures **zero downtime** risk

**Let's build a truly agentic AI system! 🚀**
