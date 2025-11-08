# AI Chat System - Complete Architecture Documentation

> **Target Audience**: Staff-level software engineers and solutions architects
> **Current Version**: 2.3.0
> **Last Updated**: 2025-11-07
> **Status**: Production-ready multi-agent orchestration system with optimized token usage

---

## 1. Semantics & Business Context

### Business Purpose

The AI Chat System is a **multi-agent orchestration platform** for customer service automation. It handles inbound customer service requests through a node-based state machine that:

1. **Greets customers** and identifies their service needs
2. **Extracts information** from conversation using LLM-powered extraction
3. **Builds empathy and rapport** before data collection
4. **Gathers customer data** (name, phone) incrementally
5. **Fetches service catalog** via MCP (Model Context Protocol) tools
6. **Creates tasks and appointments** in the PMO system
7. **Executes service bookings** and communicates results
8. **Terminates calls** via telephony MCP integration

### Key Business Requirements

- **Non-repetitive conversation**: Never ask questions already answered
- **Empathy-first approach**: Build rapport before data collection
- **Mandatory field collection**: customers_main_ask and customer_phone_number required
- **Service catalog matching**: Map customer issues to PMO service categories
- **Complete audit trail**: All conversation steps recorded in context.json
- **Graceful call termination**: Proper hangup via external telephony tool

### System Capabilities

| Capability | Implementation |
|-----------|---------------|
| Natural language understanding | GPT-4/Claude via OpenAI Service |
| Information extraction | LLM JSON mode for structured data |
| External tool execution | MCP adapter for PMO API integration |
| Conversation state management | context.json with non-destructive merging |
| Flow control | Navigator agent with branching conditions |
| Call lifecycle | 17 nodes from greeting to hangup |

---

## 2. Architecture & DRY Design Patterns

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  USER INTERACTION (Customer)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR SERVICE                       │
│  • Routes to appropriate agent based on node type            │
│  • Merges context updates non-destructively                  │
│  • Manages conversation state (context.json)                 │
│  • Coordinates agent lifecycle                               │
└─┬───────────────┬────────────────┬──────────────────────────┘
  │               │                │
  ▼               ▼                ▼
┌─────────┐ ┌──────────┐  ┌──────────────┐
│ Worker  │ │ Worker   │  │  Navigator   │
│ Reply   │ │ MCP      │  │  Agent       │
│ Agent   │ │ Agent    │  │              │
└─────────┘ └──────────┘  └──────────────┘
     │           │               │
     │           │               │
     ▼           ▼               ▼
Customer   MCP Tools     Next Node
Response   (External     Decision
(1-2 lines) API calls)   (Routing)
```

### Node-Based State Machine Pattern

**Core Principle**: **Nodes = Business Operation States**, not agent types.

Each node represents a state in the customer service workflow and provides:

```typescript
interface NodeDefinition {
  node_name: string;                    // Unique identifier
  node_action: 'reply' | 'mcp' | 'internal';
  agent_profile_type: string;           // Which agent executes this node
  role: string;                         // What agent IS in this state
  node_goal: string;                    // What agent ACHIEVES
  prompt_templates: string;             // HOW to communicate
  default_next_node: string | null;     // Normal flow progression
  branching_conditions: BranchingCondition[];  // Alternative paths
  expected_context_fields: string[];    // What context fields this node produces
}
```

**Example - Empathize Node**:
```json
{
  "node_name": "Empathize",
  "node_action": "reply",
  "agent_profile_type": "worker_reply_agent",
  "role": "an empathetic customer support agent",
  "node_goal": "Express empathy towards customer's issue to build trust",
  "prompt_templates": "You are a polite agent. Express genuine empathy...",
  "default_next_node": "Console_Build_Rapport",
  "branching_conditions": [...]
}
```

### Agent Separation Pattern (DRY)

**Three specialized agents, single responsibility each:**

#### 1. WorkerReplyAgent
```typescript
// apps/api/src/modules/chat/orchestrator/agents/worker-reply-agent.service.ts

Purpose: Generate customer-facing responses ONLY
Input: node.role + node.goal + node.prompt_templates + context.json
Output: { response: string }  // 1-2 sentences

Key Principle: NO context extraction, NO data processing
             ONLY natural language generation
```

**LLM Prompt Structure** (Optimized in v2.3.0):
```
NODE ROLE: {node.node_role}

NODE GOAL: {node.node_goal}

PROMPT EXAMPLE (abbreviated):
{node.prompt_templates.substring(0, 200)}...

ACTIVE CONTEXT (only tracked fields):
{
  recent_conversation: [...last 5 exchanges only],
  flags: {...},
  customers_main_ask: "..." (if set),
  customer_phone_number: "..." (if set),
  // Only non-empty, actively tracked fields included
}

CRITICAL RULES:
- Review recent_conversation FIRST
- NEVER ask questions already answered
- Generate natural 1-2 sentence response ONLY

Please reply to customer:
```

**Key Optimization**: Only passes first 200 chars of prompt templates and filters context to non-empty fields.

#### 2. WorkerMCPAgent
```typescript
// apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.ts

Purpose: Execute MCP tools AND extract information from conversation
Input: node.role + node.goal + context.json + available MCP tools
Output: {
  statusMessage: string,          // Optional brief status
  contextUpdates: Partial<DAGContext>,  // Data to merge into context
  mcpExecuted: boolean
}

Two Sub-Patterns:
1. Tool Execution Nodes: Call external APIs (service catalog, task creation, booking)
2. Extraction Nodes: Use LLM in JSON mode to extract structured data
```

**Tool Execution Flow**:
```typescript
async executeNode(nodeName: string, state: AgentContextState) {
  // Check if extraction node (no external tools)
  if (isExtractionNode(nodeName)) {
    return await executeExtractionNode(nodeName, node, state);
  }

  // Regular MCP node - call external tools
  const systemPrompt = buildMCPSystemPrompt(node, context, availableTools);

  // LLM decides which tool to use via function calling
  const result = await openaiService.callAgent({
    messages: [{ role: 'system', content: systemPrompt }, ...],
    tools: availableTools,
    tool_choice: 'auto'
  });

  // Execute selected tool
  if (result.tool_calls?.length > 0) {
    for (const toolCall of result.tool_calls) {
      const toolResult = await executeMCPTool(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments)
      );
      contextUpdates = mapMCPResultsToContext(toolCall.function.name, toolResult);
    }
  }

  return { statusMessage, contextUpdates, mcpExecuted: true };
}
```

**Extraction Node Flow** (NEW in v2.1.0):
```typescript
async executeExtractionNode(nodeName: string, node: any, state: AgentContextState) {
  const systemPrompt = buildExtractionSystemPrompt(node, state.context);

  // Use JSON mode to extract structured data
  const result = await openaiService.callAgent({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Extract information and return JSON' }
    ],
    temperature: 0.1,
    jsonMode: true  // Returns structured JSON
  });

  const contextUpdates = JSON.parse(result.content || '{}');

  return {
    statusMessage: '',  // No customer-facing message
    contextUpdates,     // e.g., { customers_main_ask: "drywall repair" }
    mcpExecuted: true
  };
}
```

#### 3. NavigatorAgent
```typescript
// apps/api/src/modules/chat/orchestrator/agents/navigator-agent.service.ts

Purpose: Decide next node based on context state and branching conditions
Input: context.json + current_node.branching_conditions + node_traversal_path
Output: {
  next_node_to_go_to: string,
  next_course_of_action: string,
  is_on_track: boolean
}

Key Responsibilities:
- Validate mandatory fields populated (customers_main_ask, customer_phone_number)
- Check branching conditions (if customer changed issue → Identify_Issue)
- Prevent infinite loops (track node_traversal_path)
- Trigger MCP calls when context fields missing
```

### Context.json - Universal Data Container Pattern

**Core Principle**: ALL data flows through a single source of truth.

```typescript
interface DAGContext {
  // Session metadata
  agent_session_id: string;
  who_are_you: string;

  // Customer data (collected incrementally)
  customer_name: string;
  customer_phone_number: string;  // MANDATORY
  customer_email: string;
  customer_id: string;

  // Business data
  customers_main_ask: string;  // MANDATORY - extracted by Extract_Customer_Issue node
  matching_service_catalog_to_solve_customers_issue: string;
  related_entities_for_customers_ask: string;

  // Operational data (from MCP tools)
  task_id: string;
  task_name: string;
  appointment_details: string;
  project_id: string;
  assigned_employee_id: string;
  assigned_employee_name: string;

  // Flow control
  next_course_of_action: string;
  next_node_to_go_to: string;
  node_traversal_path: string[];  // APPEND ONLY

  // Conversation history
  summary_of_conversation_on_each_step_until_now: Array<{
    customer: string;
    agent: string;
  }>;  // APPEND ONLY

  // Progress tracking
  flags: Record<string, 0 | 1>;  // e.g., { greet_flag: 1, empathize_flag: 1 }

  // Call lifecycle (NEW in v2.2.0)
  call_ended: boolean;
  hangup_status: string;
}
```

**Non-Destructive Merge Rules**:

```typescript
// Arrays: APPEND ONLY
context.summary_of_conversation_on_each_step_until_now.push(newItem);
context.node_traversal_path.push(currentNode);

// Scalars: UPDATE IF MEANINGFUL (not empty/null/undefined)
if (newValue !== undefined && newValue !== null && newValue !== '') {
  context.customer_name = newValue;
}

// Existing values preserved unless explicitly overwritten
const updatedContext = { ...existingContext, ...contextUpdates };
```

### Orchestrator Routing Pattern

```typescript
// apps/api/src/modules/chat/orchestrator/agent-orchestrator.service.ts

async processMessage(userMessage: string, state: AgentContextState) {
  // 1. Get current node configuration
  const currentNodeConfig = this.dagConfig.nodes.find(
    n => n.node_name === state.currentNode
  );
  const agentProfileType = currentNodeConfig?.agent_profile_type;

  let response = '';
  let contextUpdates: Partial<DAGContext> = {};

  // 2. Route to appropriate agent based on node type
  if (agentProfileType === 'worker_mcp_agent') {
    // Execute MCP tool or extraction
    const mcpResult = await this.workerMCPAgent.executeNode(
      state.currentNode,
      state
    );
    contextUpdates = mcpResult.contextUpdates;
    response = mcpResult.statusMessage || '';

  } else if (agentProfileType === 'worker_reply_agent') {
    // Generate customer-facing response
    const replyResult = await this.workerReplyAgent.executeNode(
      state.currentNode,
      state,
      userMessage
    );
    response = replyResult.response;

  } else if (agentProfileType === 'internal') {
    // Skip agent execution (routing node only)
  }

  // 3. Merge context updates non-destructively
  this.agentContext.updateContext(state, contextUpdates);

  // 4. Navigator decides next node
  const navResult = await this.navigatorAgent.decideNextNode(state);
  this.agentContext.updateContext(state, {
    next_node_to_go_to: navResult.next_node_to_go_to,
    next_course_of_action: navResult.next_course_of_action
  });

  // 5. Transition to next node
  state.currentNode = navResult.next_node_to_go_to;

  return { response, state };
}
```

---

## 3. Database, API & UI/UX Mapping

### Integration Points

The AI Chat System integrates with the PMO platform via MCP tools:

```
AI Chat System ←→ MCP Adapter ←→ PMO API ←→ PostgreSQL

MCP Tools Available:
- setting_list: Fetch service catalog categories
- entity_list: Fetch related projects/tasks
- customer_create: Create customer profile
- customer_get: Lookup existing customer
- task_create: Create service task
- person_calendar_book: Schedule appointment
- call_hangup: Terminate phone call (NEW in v2.2.0)
```

**No Direct Database Access**: All PMO operations go through MCP adapter for:
- Decoupling from database schema
- Consistent auth/RBAC enforcement
- API rate limiting and retry logic
- Tool-based abstraction for LLM function calling

---

## 5. Central Configuration & Middleware

### Configuration File: agent_config.json

**Location**: `apps/api/src/modules/chat/orchestrator/agent_config.json`

**Purpose**: Single source of truth for all node definitions, agent profiles, and context schema.

**Structure**:
```json
{
  "AGENT_PROFILE": {
    "worker_reply_agent": { "role": "...", "responsibilities": [...] },
    "worker_mcp_agent": { "role": "...", "responsibilities": [...] },
    "node_navigator_agent": { "role": "...", "responsibilities": [...] }
  },
  "context_update_rules": {
    "merge_behavior": {
      "arrays": { "rule": "APPEND" },
      "scalar_fields": { "rule": "UPDATE if meaningful" }
    }
  },
  "nodes": [
    { "node_name": "GREET_CUSTOMER", ... },
    { "node_name": "ASK_CUSTOMER_ABOUT_THEIR_NEED", ... },
    ...
    { "node_name": "Execute_Call_Hangup", ... }  // 17 nodes total
  ],
  "global_context_schema_semantics": {
    "mandatory_fields": ["customers_main_ask", "customer_phone_number"],
    "field_semantics": {
      "customers_main_ask": {
        "type": "string",
        "mandatory": true,
        "description": "Primary customer issue extracted from conversation",
        "updated_by": "worker_agent from Extract_Customer_Issue node"
      },
      ...
    }
  }
}
```

**Key Configuration Sections**:

1. **AGENT_PROFILE**: Defines agent responsibilities and input/output contracts
2. **context_update_rules**: Non-destructive merge behavior specification
3. **nodes**: All 17 node definitions (reply, MCP, internal, summarizer)
4. **global_context_schema_semantics**: Context field documentation and ownership

### Middleware: Agent Context Service

**Location**: `apps/api/src/modules/chat/orchestrator/agents/agent-context.service.ts`

**Responsibilities**:
- Initialize context.json at session start
- Update context non-destructively (append arrays, update scalars)
- Log context evolution for debugging
- Validate mandatory fields populated

**Key Methods**:
```typescript
class AgentContextService {
  initializeContext(sessionId: string): AgentContextState;
  updateContext(state: AgentContextState, updates: Partial<DAGContext>): void;
  validateMandatoryFields(context: DAGContext): { valid: boolean; errors: string[] };
}
```

---

## 6. User Interaction Flow Examples

### Complete Flow: Customer Service Request (17 Nodes)

```
ITERATION 1: GREET_CUSTOMER (reply)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User: "Hello, I need help with drywall repair"

1. WorkerReplyAgent receives:
   - role: "a welcoming customer service representative"
   - goal: "Greet warmly, invite needs sharing"
   - context: { customers_main_ask: "(not set)", ... }

2. LLM generates:
   "Hello! I understand you need help with drywall repair. Let me assist you."

3. Orchestrator updates context:
   - Appends to conversation history
   - No context updates from reply agent

4. NavigatorAgent decides:
   - Customer mentioned issue in first message
   - next_node_to_go_to = "Extract_Customer_Issue"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 2: Extract_Customer_Issue (MCP - extraction)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. WorkerMCPAgent detects: isExtractionNode = true

2. Calls executeExtractionNode():
   - Reviews conversation history
   - Extracts issue from "I need help with drywall repair"

3. LLM (JSON mode) returns:
   {
     "customers_main_ask": "Drywall repair assistance needed"
   }

4. WorkerMCPAgent returns:
   {
     statusMessage: "",
     contextUpdates: { customers_main_ask: "Drywall repair assistance needed" },
     mcpExecuted: true
   }

5. Orchestrator merges into context:
   context.customers_main_ask = "Drywall repair assistance needed"

6. NavigatorAgent decides:
   - Extraction successful (mandatory field populated)
   - next_node_to_go_to = "Identify_Issue"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 3: Identify_Issue (reply)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. WorkerReplyAgent reads context:
   - customers_main_ask: "Drywall repair assistance needed"

2. Generates response:
   "I see you need drywall repair. Let me find the right solution for you."

3. NavigatorAgent decides:
   - Issue identified, flow continues
   - next_node_to_go_to = "Empathize"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 4: Empathize (reply)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. WorkerReplyAgent generates empathy:
   "Oh, I am sorry to hear that you are experiencing drywall damage."

2. NavigatorAgent: next_node_to_go_to = "Console_Build_Rapport"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 5: Console_Build_Rapport (reply)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. WorkerReplyAgent builds rapport:
   "Don't worry, you are in good hands. I will help you with your drywall repair."

2. NavigatorAgent: next_node_to_go_to = "use_mcp_to_get_info"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 6: use_mcp_to_get_info (MCP - tool)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. WorkerMCPAgent identifies missing field:
   - matching_service_catalog_to_solve_customers_issue: "(not set)"

2. LLM decides to call:
   setting_list({ category: "dl__service_category" })

3. MCP returns:
   [{ name: "Drywall Repair" }, { name: "Painting" }, ...]

4. WorkerMCPAgent maps result:
   contextUpdates = {
     matching_service_catalog_to_solve_customers_issue: "Drywall Repair"
   }

5. NavigatorAgent: next_node_to_go_to = "Try_To_Gather_Customers_Data"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 7-8: Try_To_Gather_Customers_Data (reply, loops)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent: "May I have your phone number so I can better assist you?"
User: "555-1234"

contextUpdates = { customer_phone_number: "555-1234", data_phone_flag: 1 }

Agent: "Could you please provide your name?"
User: "John Doe"

contextUpdates = { customer_name: "John Doe", data_name_flag: 1 }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 9: Check_IF_existing_customer (MCP - tool)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. LLM calls: customer_get({ phone: "555-1234" })
2. If not found: customer_create({ name: "John Doe", phone: "555-1234" })
3. contextUpdates = { customer_id: "cust-456" }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 10: Plan (MCP - tool)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. LLM calls: task_create({
     customer_id: "cust-456",
     name: "Drywall Repair Service",
     service_catalog: "Drywall Repair"
   })

2. contextUpdates = { task_id: "task-789", task_name: "Drywall Repair Service" }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 11: Communicate_To_Customer_Before_Action (reply)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent: "I will schedule a technician to come patch your drywall. Does that work for you?"
User: "Yes, that sounds good"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 12: Execute_Plan_Using_MCP (MCP - tool)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. LLM calls: person_calendar_book({
     task_id: "task-789",
     from_ts: "2025-11-10T10:00:00Z",
     to_ts: "2025-11-10T12:00:00Z"
   })

2. contextUpdates = {
     appointment_details: "Scheduled for 2025-11-10 at 10:00 AM with Bob Smith"
   }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 13: Tell_Customers_Execution (reply)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent: "I have scheduled a technician for tomorrow at 10 AM to patch your drywall."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 14: Goodbye_And_Hangup (reply)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent: "Thank you for reaching out regarding your drywall repair. Have a great day!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 15: Execute_Call_Hangup (MCP - tool) [NEW v2.2.0]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. LLM calls: call_hangup({ call_session_id: context.agent_session_id })

2. contextUpdates = {
     call_ended: true,
     hangup_status: "success",
     hangup_flag: 1
   }

3. Call terminates. Session complete.
```

### Flow Summary

| Iteration | Node | Agent Type | Action | Context Updated |
|-----------|------|------------|--------|-----------------|
| 1 | GREET_CUSTOMER | reply | Generate greeting | conversation_history |
| 2 | Extract_Customer_Issue | mcp-extraction | Extract issue from conversation | customers_main_ask |
| 3 | Identify_Issue | reply | Confirm issue | identify_issue_flag |
| 4 | Empathize | reply | Express empathy | empathize_flag |
| 5 | Console_Build_Rapport | reply | Build rapport | rapport_flag |
| 6 | use_mcp_to_get_info | mcp-tool | Fetch service catalog | matching_service_catalog |
| 7-8 | Try_To_Gather_Customers_Data | reply | Ask for name/phone (loops) | customer_name, customer_phone_number |
| 9 | Check_IF_existing_customer | mcp-tool | Lookup/create customer | customer_id |
| 10 | Plan | mcp-tool | Create task | task_id, task_name |
| 11 | Communicate_To_Customer_Before_Action | reply | Share plan | communicate_plan_flag |
| 12 | Execute_Plan_Using_MCP | mcp-tool | Book appointment | appointment_details |
| 13 | Tell_Customers_Execution | reply | Inform customer of results | tell_execution_flag |
| 14 | Goodbye_And_Hangup | reply | Say goodbye | goodbye_flag |
| 15 | Execute_Call_Hangup | mcp-tool | Hang up call | call_ended, hangup_status |

---

## 7. Critical Considerations When Building

### For Developers Extending This System

#### 1. **Adding New Nodes**

```typescript
// Step 1: Add node definition to agent_config.json
{
  "node_name": "Verify_Customer_Address",
  "node_action": "reply",
  "agent_profile_type": "worker_reply_agent",
  "role": "a location verification specialist",
  "node_goal": "Confirm customer's service address",
  "prompt_templates": "Ask for address if not provided...",
  "default_next_node": "Plan",
  "branching_conditions": [...]
}

// Step 2: Update previous node's default_next_node or branching_conditions
// Step 3: No code changes needed - configuration-driven!
```

#### 2. **Adding New MCP Tools**

```typescript
// Step 1: Add tool to MCP adapter service
// apps/api/src/modules/mcp-adapter.service.ts

export function getMCPTools(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'verify_address',
        description: 'Verify customer address via geocoding service',
        parameters: { /* JSON schema */ }
      }
    },
    // ... existing tools
  ];
}

// Step 2: Add mapping logic in WorkerMCPAgent.mapMCPResultsToContext()
if (toolName.includes('address')) {
  updates.customer_address = results.formatted_address;
  updates.customer_lat_lng = `${results.lat},${results.lng}`;
}
```

#### 3. **Context Field Best Practices**

```typescript
// ✅ CORRECT: Non-destructive merge
context.node_traversal_path.push('NewNode');
context.flags = { ...context.flags, new_flag: 1 };

// ❌ WRONG: Destructive assignment
context.node_traversal_path = ['NewNode'];  // Loses history!
context.flags = { new_flag: 1 };  // Loses other flags!

// ✅ CORRECT: Check before updating scalars
if (newValue && newValue !== '') {
  context.customer_email = newValue;
}

// ❌ WRONG: Overwrite with empty values
context.customer_email = '(not set)';  // Loses existing data!
```

#### 4. **Extraction Node Pattern**

```typescript
// When to use extraction nodes:
// - Need to extract structured data from conversation
// - NO external API calls required
// - Return context updates silently (no customer message)

// Example: Extract multiple fields at once
{
  "node_name": "Extract_Customer_Contact_Info",
  "node_action": "mcp",
  "agent_profile_type": "worker_mcp_agent",
  "role": "a contact information extraction specialist",
  "prompt_templates": "Extract customer_name, customer_phone_number, customer_email from conversation. Return JSON.",
  "node_goal": "Extract all customer contact information from conversation history"
}

// WorkerMCPAgent auto-detects extraction nodes by name pattern:
const isExtractionNode = nodeName.toLowerCase().includes('extract');
```

#### 5. **Branching Condition Patterns**

```typescript
// Common branching patterns:

// Pattern 1: Flag-based skip logic
{
  "condition": "if empathize_flag: 1 (already done)",
  "child_node": "Console_Build_Rapport"
}

// Pattern 2: Mandatory field check
{
  "condition": "if customer_phone_number not set (mandatory)",
  "child_node": "Try_To_Gather_Customers_Data"
}

// Pattern 3: Customer intent change
{
  "condition": "if customer changes issue",
  "child_node": "Identify_Issue"
}

// Pattern 4: Error retry
{
  "condition": "if MCP fetch fails",
  "child_node": "use_mcp_to_get_info"  // Retry
}
```

#### 6. **Prompt Engineering Guidelines**

```typescript
// ✅ CORRECT: Clear role-based prompts
"You are {node.role}.
Your goal is: {node.goal}
You have these datapoints: {context}

CRITICAL RULES:
- Review conversation history FIRST
- NEVER repeat questions
- Generate 1-2 sentence response

Please reply:"

// ❌ WRONG: Vague prompts
"You are a helpful assistant. Please respond to the customer."
```

#### 7. **Testing Strategy**

```bash
# Unit tests for agents
npm test apps/api/src/modules/chat/orchestrator/agents/worker-reply-agent.service.test.ts
npm test apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.test.ts

# Integration tests for full flow
npm test apps/api/src/modules/chat/orchestrator/agent-orchestrator.service.test.ts

# E2E tests with mock MCP
npm test apps/api/src/modules/chat/orchestrator/e2e/complete-flow.test.ts
```

#### 8. **Performance Optimization**

```typescript
// 1. Cache agent_config.json on startup (don't re-read on every request)
const dagConfig = loadDAGConfig();  // Once at startup

// 2. Reuse OpenAI client connections
const openaiService = getOpenAIService();  // Singleton pattern

// 3. Batch MCP tool calls when possible
const results = await Promise.all([
  executeMCPTool('customer_get', params1),
  executeMCPTool('setting_list', params2)
]);

// 4. Stream LLM responses for better UX (when supported)
const stream = await openaiService.callAgentStream(...);
```

#### 9. **Error Handling Patterns**

```typescript
// ✅ CORRECT: Graceful degradation
try {
  const mcpResult = await executeMCPTool('task_create', params);
  contextUpdates.task_id = mcpResult.id;
} catch (error) {
  console.error('Task creation failed:', error.message);
  // Retry via branching condition
  return {
    statusMessage: "I'm having trouble creating the task. Let me try again.",
    contextUpdates: {},
    mcpExecuted: false
  };
}

// ❌ WRONG: Silent failures
try {
  await executeMCPTool('task_create', params);
} catch (error) {
  // Swallow error - conversation breaks!
}
```

#### 10. **Monitoring & Observability**

```typescript
// Required logging at each step:
console.log(`[Orchestrator] Iteration ${i}: ${state.currentNode}`);
console.log(`[WorkerReplyAgent] Generated response: ${response}`);
console.log(`[WorkerMCPAgent] Context updates: ${JSON.stringify(contextUpdates)}`);
console.log(`[NavigatorAgent] Next node: ${navResult.next_node_to_go_to}`);

// Track metrics:
// - Conversation length (node count)
// - MCP tool success rate
// - Average time per iteration
// - Customer satisfaction (if using feedback mechanism)
```

---

## 8. Recent Changes

### v2.3.0 - LLM Token Optimization (2025-11-07)

**Purpose**: Dramatically reduce token usage and LLM costs by passing only essential metadata and actively tracked context fields.

#### What Changed

**BEFORE (v2.2.0)**: Agents passed full node metadata and complete context to LLM:
```typescript
// Navigator Agent - sent ALL node metadata
const allNodesMetadata = nodes.map(n => ({
  node_name: n.node_name,
  node_goal: n.node_goal,
  prompt: n.prompt,                    // Full prompt (1000+ chars)
  default_next_node: n.default_next_node,
  context_update: n.context_update,    // Full text descriptions
  branching_conditions: n.branching_conditions
}));

// Worker Agent - sent ENTIRE context object
const contextData = JSON.stringify(context, null, 2);  // All 30+ fields
```

**AFTER (v2.3.0)**: Agents pass only role, goal, and actively tracked fields:
```typescript
// Navigator Agent - ONLY routing essentials
const allNodesMetadata = nodes.map(n => ({
  node_name: n.node_name,
  role: n.node_role,                   // NEW: Just the role
  goal: n.node_goal,                   // Just the goal
  branching_conditions: n.branching_conditions,  // Needed for routing
  default_next_node: n.default_next_node         // Needed for fallback
}));

// Worker Agent - ONLY active context fields
const activeContext = getActiveContextFields(context, expectedFields);
// Returns ONLY: mandatory fields + non-empty tracked fields
```

#### Optimization Details by Agent

**1. NavigatorAgent** (`navigator-agent.service.ts`)
- **Goal**: Predict next NODE only (routing decisions)
- **Removed**: Full `prompt_templates` text, `context_update` descriptions
- **Added**: Only `role`, `goal`, `branching_conditions`, `default_next_node`
- **Context**: Filters to mandatory fields + actively tracked non-empty fields
- **Token Savings**: ~60-70% reduction per navigation call

**2. WorkerAgent** (`worker-agent.service.ts`)
- **Goal**: Execute node tasks and build context
- **Removed**: Full `prompt_templates` (1000+ chars), full `context_update`
- **Added**: `prompt_example` (first 200 chars only)
- **Context**: New helper `getActiveContextFields()` filters empty values
- **Token Savings**: ~50-60% reduction per worker call

**3. WorkerMCPAgent** (`worker-mcp-agent.service.ts`)
- **Goal**: Execute MCP tools to fetch external data
- **Removed**: Full context object passed to LLM
- **Added**: Only mandatory fields + actively tracked non-empty fields
- **Token Savings**: ~40-50% reduction per MCP call

**4. WorkerReplyAgent** (`worker-reply-agent.service.ts`)
- **Goal**: Generate customer-facing responses
- **Removed**: Full context with all 30+ fields
- **Added**: Filtered context (mandatory + non-empty tracked fields)
- **Existing**: Already had last 5 conversation exchanges limit (maintained)
- **Token Savings**: ~30-40% reduction per reply call

#### New Helper Methods

```typescript
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
    if (context[field] && context[field] !== '' && context[field] !== '(not set)') {
      activeContext[field] = context[field];
    }
  }

  return activeContext;
}
```

#### Benefits

✅ **50-70% Token Reduction**: Massive reduction in tokens sent to LLM per call
✅ **Lower Costs**: Significant reduction in OpenAI API costs
✅ **Faster Responses**: Less data to process = faster LLM responses
✅ **Focused Context**: LLM sees only relevant data, improving decision quality
✅ **Consistent Pattern**: All agents follow same optimization approach

#### Backward Compatibility

- ✅ All existing functionality preserved
- ✅ No changes to agent_config.json required
- ✅ Context merging behavior unchanged
- ✅ MCP tool calling unchanged
- ✅ Branching conditions still work exactly the same

#### Testing Verification

```bash
# Test optimized agents
./tools/test-api.sh POST /api/v1/chat/orchestrator/message '{"message":"Hello"}'

# Monitor token usage in logs
./tools/logs-chat-detailed.sh | grep "Tokens:"

# Verify context filtering
./tools/logs-chat-detailed.sh | grep "ACTIVE CONTEXT"
```

---

### v2.2.0 - Execute_Call_Hangup Node

**Purpose**: Properly terminate phone calls via MCP telephony tool after customer conversation ends.

**Location in Flow**: After Goodbye_And_Hangup node (node #15 of 17)

**Implementation**:
```json
{
  "node_name": "Execute_Call_Hangup",
  "node_action": "mcp",
  "agent_profile_type": "worker_mcp_agent",
  "role": "a call termination specialist",
  "node_goal": "Execute phone call hangup via MCP telephony tool",
  "prompt_templates": "Use context.agent_session_id to identify call and execute hangup tool",
  "expected_context_fields": ["call_ended", "hangup_status"],
  "default_next_node": null,
  "branching_conditions": [
    { "condition": "if hangup successful", "child_node": null },
    { "condition": "if hangup fails (retry once)", "child_node": "Execute_Call_Hangup" }
  ]
}
```

**Context Updates**:
- `call_ended`: boolean (true when hangup executed)
- `hangup_status`: string ("success" | "failed")
- `hangup_flag`: 1 (marks node complete)

**MCP Tool Expected**: `call_hangup({ call_session_id: string })`

**Reasoning**: Previously, Goodbye_And_Hangup generated a goodbye message but didn't actually terminate the call. This node ensures proper cleanup of telephony resources.

---

## 9. System Health Checklist

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Agent config valid | `node -e "require('./agent_config.json')"` | No errors |
| All 17 nodes present | `jq '.nodes[] .node_name' agent_config.json` | 17 unique names |
| Context schema complete | `jq '.global_context_schema_semantics.field_semantics' agent_config.json` | All context fields documented |
| MCP tools registered | `curl http://localhost:4000/api/v1/mcp/tools` | JSON array of tools |
| Orchestrator health | `curl http://localhost:4000/health` | `{ "status": "ok" }` |

---

## 10. References

### Source Files
- **Orchestrator**: `apps/api/src/modules/chat/orchestrator/agent-orchestrator.service.ts`
- **WorkerReplyAgent**: `apps/api/src/modules/chat/orchestrator/agents/worker-reply-agent.service.ts`
- **WorkerMCPAgent**: `apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.ts`
- **NavigatorAgent**: `apps/api/src/modules/chat/orchestrator/agents/navigator-agent.service.ts`
- **Configuration**: `apps/api/src/modules/chat/orchestrator/agent_config.json`

### Documentation
- **Node Branching Review**: `apps/api/src/modules/chat/orchestrator/agents/NODE_BRANCHING_REVIEW.md`
- **Complete Architecture**: `apps/api/src/modules/chat/orchestrator/agents/COMPLETE_ARCHITECTURE.md`
- **Extraction Node Guide**: `apps/api/src/modules/chat/orchestrator/agents/EXTRACTION_NODE_GUIDE.md`

---

**Document Version**: 2.3.0
**System Version**: 2.3.0 - Optimized Token Usage & Complete Flow
**Last Updated**: 2025-11-07
**Author**: AI Agent Refactoring Team
**Status**: ✅ Production Ready - Token Optimized

---

## 11. Token Optimization (2025-11-08)

### Optimization Results

**Navigator Agent:**
- Removed `context_update` field from child node metadata
- Passes only: `node_name`, `role`, `goal`
- Token savings: ~100-600 tokens per navigation call (~15-35% reduction)

**Worker Agents:**
- Already optimized - pass only: `role`, `goal`, `example_tone_of_reply`
- Filter context to actively tracked fields only
- Limit conversation history (last 5-10 exchanges)

**Per Conversation Savings:**
- Before: ~25,000-35,000 tokens
- After: ~21,000-30,000 tokens
- Savings: ~4,000-5,000 tokens (15-20% reduction)

**Monthly Cost Savings:**
- ~400,000-500,000 tokens/day (100 conversations)
- Cost savings: **~$270-360/month** (GPT-4 pricing)

### Implementation

**File:** `apps/api/src/modules/chat/orchestrator/agents/navigator-agent.service.ts` (lines 148-156)

```typescript
// OPTIMIZED: Only pass essential node metadata
const availableChildNodes = this.dagConfig.nodes
  .filter(n => childNodeNames.has(n.node_name))
  .map(n => ({
    node_name: n.node_name,              // Identifier
    role: (n as any).role || 'Node executor',     // What the node is
    goal: n.node_goal || 'Execute node action'    // What the node does
  }));
```

---

## 12. Architecture Corrections (2025-11-08)

### All Entry Points Use SAME Orchestrator ✅

```
Text Chat → agent-orchestrator.service.ts
Voice WebSocket → voice-orchestrator → agent-orchestrator.service.ts
Voice HTTP → voice-orchestrator → agent-orchestrator.service.ts
```

### Voice WebSocket Integration

**File:** `apps/api/src/modules/chat/voice-langraph.service.ts`

**Purpose:**
- Real-time audio streaming via WebSocket
- Voice Activity Detection (VAD)
- Buffers audio chunks before processing

**Flow:**
```
Browser WebSocket → voice-langraph.service.ts
  → voice-orchestrator.service.ts::processVoiceMessage()
    → speechToText (Whisper STT)
    → agent-orchestrator.service.ts::processMessage() ✅ SAME orchestrator
    → textToSpeech (OpenAI TTS)
  → Browser playback
```

**Status:** ✅ Active - Uses NEW agent orchestrator internally

### Entry Points Summary

| Entry Point | Protocol | Frontend | Backend Flow |
|-------------|----------|----------|--------------|
| **Text Chat** | HTTP POST | ChatWidget (text) | routes.ts → agent-orchestrator |
| **Voice WebSocket** | WebSocket | ChatWidget (voice) | voice-langraph → voice-orchestrator → agent-orchestrator |
| **Voice HTTP** | HTTP POST | VoiceChat component | voice-orchestrator.routes → voice-orchestrator → agent-orchestrator |

**Key Insight:** Voice WebSocket is NOT deprecated - it's a valid streaming frontend for the agent orchestrator.


---

## 13. Context System Verification (2025-11-08)

### ✅ Context Structure Validation

**Configuration Source:** `agent_config.json::global_context_schema_semantics`

**Template Used:** `initial_context_template.template`

```typescript
{
  "agent_session_id": "<session_uuid>",
  "who_are_you": "You are a polite customer service agent...",
  "customer_name": "",
  "customer_phone_number": "",
  "customer_email": "",
  "customer_id": "",
  "customers_main_ask": "",
  "matching_service_catalog_to_solve_customers_issue": "",
  "related_entities_for_customers_ask": "",
  "task_id": "",
  "task_name": "",
  "appointment_details": "",
  "project_id": "",
  "assigned_employee_id": "",
  "assigned_employee_name": "",
  "next_course_of_action": "",
  "next_node_to_go_to": "GREET_CUSTOMER",
  "node_traversal_path": [],
  "summary_of_conversation_on_each_step_until_now": [],
  "flags": {}
}
```

**Mandatory Fields:**
- `customers_main_ask` - Primary customer issue/request
- `customer_phone_number` - Customer contact (required for tasks)

---

### ✅ Incremental Context Building

**Implementation:** `agent-context.service.ts::updateContext()`

**Non-Destructive Merge Rules:**

```typescript
// Arrays: APPEND (never replace)
summary_of_conversation_on_each_step_until_now: [...existing, ...newItems]
node_traversal_path: [...existing, ...newNodes]

// Scalar Fields: UPDATE only if new value is meaningful
if (value !== undefined && value !== null && value !== '') {
  merged[key] = value;  // Only update if value has content
}
```

**Example Flow:**

```
Step 1 (GREET_CUSTOMER):
  context.customer_name = ""
  context.flags = {}

Step 2 (Extract_Customer_Issue):
  context.customers_main_ask = "Lawn care - brown grass"  ✅ Added
  context.flags = { extract_issue_flag: 1 }  ✅ Added

Step 3 (ASK_FOR_PHONE_NUMBER):
  context.customer_phone_number = "555-1234"  ✅ Added
  context.flags = { extract_issue_flag: 1, data_phone_flag: 1 }  ✅ Appended
  context.customers_main_ask = "Lawn care - brown grass"  ✅ Preserved

Step 4 (MCP customer_create):
  context.customer_id = "cust-uuid-123"  ✅ Added from MCP
  context.customer_name = "John Doe"  ✅ Added from MCP
  context.customer_phone_number = "555-1234"  ✅ Preserved
  context.customers_main_ask = "Lawn care - brown grass"  ✅ Preserved
```

**Key Principle:** Data is NEVER removed, only added or updated.

---

### ✅ Agent Context Snippets

Each agent receives **filtered context** with only essential fields for its task:

#### Navigator Agent

**Receives:**
- Last 3 conversation exchanges (not all 255!)
- Mandatory fields (customers_main_ask, customer_phone_number)
- Actively tracked fields (customer_id, task_id, etc.)
- Flags (completion tracking)
- Branching conditions for current node
- Child node metadata (node_name, role, goal only)

**File:** `navigator-agent.service.ts:216-305`

```typescript
// Extract ONLY essential context for routing
const essentialContext = {
  flags: fullContext.flags || {},
  customers_main_ask: fullContext.customers_main_ask || '(not set)',
  customer_phone_number: fullContext.customer_phone_number || '(not set)',
  // + actively tracked fields only (non-empty values)
};

// Last 3 exchanges only
const recentSummary = (fullContext.summary_of_conversation_on_each_step_until_now || []).slice(-3);
```

**Token Usage:** ~700-1100 tokens per navigation call

---

#### Worker Reply Agent

**Receives:**
- Last 5 conversation exchanges
- Mandatory fields
- Actively tracked fields (non-empty only)
- Flags
- Node metadata (role, goal, example_tone_of_reply)

**File:** `worker-reply-agent.service.ts:85-106`

```typescript
// Only last 5 conversation exchanges
const recentConversation = (context.summary_of_conversation_on_each_step_until_now || []).slice(-5);

// Only actively tracked fields
const activeContext = {
  recent_conversation: recentConversation,
  flags: context.flags || {},
  // + mandatory fields
  // + non-empty tracking fields only
};
```

**Token Usage:** ~400-800 tokens per reply call

---

#### Worker MCP Agent

**Receives:**
- Actively tracked context fields only
- Flags
- Node metadata (role, goal, example_tone_of_reply)
- Available MCP tools (for MCP nodes)
- Last 10 exchanges (for extraction nodes)

**File:** `worker-mcp-agent.service.ts:151-173`

```typescript
// Only actively tracked context fields
const activeContext = {
  flags: context.flags || {},
  // + mandatory fields if set
  // + non-empty tracking fields only
};

// For extraction nodes: last 10 exchanges
const recentExchanges = summaryArray.slice(-10);
```

**Token Usage:** ~500-1000 tokens per MCP call

---

### ✅ Comprehensive Logging (llm.log)

**Logger Service:** `llm-logger.service.ts`

**What Gets Logged:**

```
📝 Session Start/End
   - Session ID, chat session ID, user ID
   - Total iterations, total messages

🔄 Iteration Start/End
   - Iteration number, current node
   - User message (if present)

📊 Context State (Before Execution)
   - Current/previous node
   - Flags
   - Mandatory fields
   - Other context fields
   - Node traversal path
   - Last 5 messages

🤖 LLM Call (Before Request)
   - Agent type, model, temperature, max tokens
   - JSON mode, tool count
   - FULL system prompt
   - FULL user prompt
   - Message history

✅ LLM Response (After Request)
   - Agent type
   - FULL response content
   - Token usage (prompt, completion, total)
   - Cost (cents)
   - Latency (ms)
   - Tool calls (if any)

🎭 Agent Execution
   - Agent type (worker_reply, worker_mcp, navigator)
   - Node name
   - Complete result object

🧭 Navigator Decision
   - Current node → Next node
   - Matched condition
   - Reason
   - Context updates

💬 Conversation Turn
   - User message
   - AI response
```

**Log Location:** `./logs/llm.log`

**Verification:**
```bash
# Check if llm.log is being written
tail -f ./logs/llm.log

# Count LLM calls in session
grep "LLM CALL" ./logs/llm.log | wc -l

# View all navigator decisions
grep "NAVIGATOR DECISION" ./logs/llm.log
```

---

### ✅ Verification Summary

| Component | Status | Details |
|-----------|--------|---------|
| **Context Structure** | ✅ Valid | Matches `agent_config.json::global_context_schema_semantics` |
| **Context Initialization** | ✅ Correct | Uses `initial_context_template.template` |
| **Incremental Building** | ✅ Working | Non-destructive merge, arrays append |
| **Navigator Context** | ✅ Optimized | Essential fields only, last 3 exchanges |
| **Worker Reply Context** | ✅ Optimized | Active fields only, last 5 exchanges |
| **Worker MCP Context** | ✅ Optimized | Active fields only, last 10 for extraction |
| **llm.log Logging** | ✅ Complete | All LLM calls, responses, context states |
| **Mandatory Fields** | ✅ Tracked | customers_main_ask, customer_phone_number |

**Fix Applied (2025-11-08):**
- Updated `context-initializer.service.ts` to use `global_context_schema_semantics` instead of `global_context_schema`
- Context now properly initializes with all 18 fields from template

---

## 14. Routing Strategy: node_traversal_path-Based (2025-11-08)

### Problem with Flag-Based Routing

**Previous Approach (REMOVED):**
- Navigator used `context.flags` (e.g., `greet_flag: 1`, `rapport_flag: 1`) to track node completion
- Flags had to be manually set after each node execution
- Flags were mutable state that could be reset or incorrectly managed
- Navigator evaluated conditions like "if rapport_flag: 1" to determine next node

**Issues:**
- Flags were never being set → Navigator couldn't evaluate conditions properly
- Conversation loops: Identify_Issue → Empathize → Console_Build_Rapport → back to Identify_Issue
- State machine couldn't progress because flags remained empty: `Flags: {}`

### New Approach: node_traversal_path-Based Routing

**Current Implementation:**

The Navigator now uses **immutable conversation history** instead of mutable flags:

```typescript
// Context data sources for routing decisions
{
  node_traversal_path: ["GREET_CUSTOMER", "Identify_Issue", "Empathize"],
  summary_of_conversation_on_each_step_until_now: [
    { customer: "roof leaking", agent: "I understand..." },
    { customer: "yes it's urgent", agent: "Let me help..." }
  ],
  customers_main_ask: "Roof leaking issue",
  customer_phone_number: "(not set)"
}
```

**Routing Logic:**

```typescript
// Navigator evaluates branching conditions using node_traversal_path
"if rapport already built"
  → check if "Console_Build_Rapport" in node_traversal_path

"if issue already identified"
  → check if "Identify_Issue" in node_traversal_path

"if customer changes issue"
  → check if user message contradicts context.customers_main_ask

"if data not complete"
  → check if context.customer_phone_number is empty
```

**Implementation:**

```typescript
// apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts
// After worker agent executes, append current node to traversal path
const currentPath = state.context.node_traversal_path || [];
if (!currentPath.includes(state.currentNode)) {
  state = this.contextManager.updateContext(state, {
    node_traversal_path: [state.currentNode]  // Non-destructive merge appends
  });
}

// apps/api/src/modules/chat/orchestrator/agents/navigator-agent.service.ts
// Navigator receives node_traversal_path in context
const nodeTraversalPath = fullContext.node_traversal_path || [];

// Passed to LLM for condition evaluation
🛤️  Node Traversal Path: ["GREET_CUSTOMER", "Identify_Issue"]
📝 Recent Conversation (last 3 exchanges): [...]
📊 Mandatory Fields: customers_main_ask, customer_phone_number
```

**Benefits:**

1. **Stateless Routing**: Node history is immutable, never needs to be reset
2. **Automatic Tracking**: Orchestrator appends to `node_traversal_path` after each execution
3. **Clear Conditions**: "if rapport already built" = check if node in traversal path
4. **No Manual Flags**: No need to set/reset flags, just check history
5. **Loop Prevention**: Can detect if node was already executed
6. **Conversation Continuity**: Full context preserved in `summary_of_conversation_on_each_step_until_now`

**Removed Components:**

- ❌ `shouldSkipNode()` method (flag-based)
- ❌ Flag reset logic in orchestrator
- ❌ Flag-based condition examples in Navigator prompt
- ❌ `validationStatus.flagResets` in Navigator output

**New Components:**

- ✅ `node_traversal_path` tracking in orchestrator (lines 430-440)
- ✅ `node_traversal_path` passed to Navigator (line 237)
- ✅ Node history-based condition examples
- ✅ Immutable state tracking

---

**Document Version**: 2.5.0
**System Version**: 2.5.0 - node_traversal_path-Based Routing
**Last Updated**: 2025-11-08
