# Complete Agent System Architecture
## ✅ Final Refactored Implementation

---

## 🎯 Architecture Principles

### 1. **Node = Business Operation State**
Nodes are states in the business process. Each node provides:
- `role`: What the agent IS in this state
- `node_goal`: What the agent ACHIEVES
- `prompt_templates`: HOW to communicate
- `agent_profile_type`: WHICH agent executes this node
- `branching_conditions`: WHERE to go next

### 2. **Context.json = Universal Data Container**
ALL data flows through `context.json`:
- Customer data: `customer_name`, `customer_phone_number`, `customer_email`, `customer_id`
- Business data: `customers_main_ask`, `matching_service_catalog_to_solve_customers_issue`
- Operational data: `task_id`, `appointment_details`, `project_id`, `assigned_employee_id`
- Flow control: `next_node_to_go_to`, `next_course_of_action`, `flags`
- History: `summary_of_conversation_on_each_step_until_now`, `node_traversal_path`

### 3. **Agents = State Executors**
Agents execute based on **node state + context data**:

```
LLM Prompt Structure:
You are {node.role}.
Your goal is: {node.node_goal}.
You have these datapoints (context): {context.json}.
Prompt examples: {node.prompt_templates}.

Please reply to customer (or) Please call MCP tool.
```

---

## 📋 Complete Node List (15 Nodes)

### Customer-Facing Nodes (9 nodes - `worker_reply_agent`)

| # | Node Name | Role | Goal |
|---|-----------|------|------|
| 1 | GREET_CUSTOMER | welcoming representative | Greet warmly, invite needs sharing |
| 2 | ASK_CUSTOMER_ABOUT_THEIR_NEED | helpful agent | Elicit primary need/issue |
| 3 | Identify_Issue | problem-solving specialist | Confirm issue empathetically |
| 5 | Empathize | empathetic support agent | Acknowledge problem, build trust |
| 6 | Console_Build_Rapport | reassuring professional | Comfort, assure assistance |
| 7 | Try_To_Gather_Customers_Data | data collection specialist | Ask for name, phone incrementally |
| 10 | Communicate_To_Customer_Before_Action | transparent specialist | Share plan before proceeding |
| 12 | Tell_Customers_Execution | update delivery specialist | Inform about completed actions |
| 13 | Goodbye_And_Hangup | courteous closure specialist | End warmly, professionally |

### MCP Tool Nodes (4 nodes - `worker_mcp_agent`)

| # | Node Name | Role | Goal | MCP Action |
|---|-----------|------|------|------------|
| 4 | use_mcp_to_get_info | data-gathering assistant | Fetch service catalog, entities | Lookup service catalog |
| 8 | Check_IF_existing_customer | customer verification assistant | Lookup/create customer profile | Create/get customer_id |
| 9 | Plan | service planning coordinator | Create task, assign employee | Create task via MCP |
| 11 | Execute_Plan_Using_MCP | service execution coordinator | Book calendar, finalize | Block calendars |

### Internal Nodes (2 nodes)

| # | Node Name | Agent Type | Purpose |
|---|-----------|------------|---------|
| 14 | wait_for_customers_reply | internal | Wait for user input |
| 15 | summarize_the_conversation... | summarizer_agent | Maintain conversation summary |

---

## 🔄 Business Flow with Branching

```
1. GREET_CUSTOMER (reply)
   ├─ if issue mentioned → Identify_Issue
   └─ else → ASK_CUSTOMER_ABOUT_THEIR_NEED

2. ASK_CUSTOMER_ABOUT_THEIR_NEED (reply)
   └─ when customer states issue → Identify_Issue

3. Identify_Issue (reply)
   └─ → use_mcp_to_get_info (fetch service catalog)

4. use_mcp_to_get_info (MCP)
   └─ → Empathize

5. Empathize (reply)
   └─ → Console_Build_Rapport

6. Console_Build_Rapport (reply)
   └─ → Try_To_Gather_Customers_Data

7. Try_To_Gather_Customers_Data (reply)
   ├─ if data incomplete → Try_To_Gather_Customers_Data (loop)
   └─ when data complete → Check_IF_existing_customer

8. Check_IF_existing_customer (MCP - lookup/create customer)
   └─ → Plan

9. Plan (MCP - create task, assign employee)
   └─ → Communicate_To_Customer_Before_Action

10. Communicate_To_Customer_Before_Action (reply)
    └─ → Execute_Plan_Using_MCP

11. Execute_Plan_Using_MCP (MCP - book calendar)
    └─ → Tell_Customers_Execution

12. Tell_Customers_Execution (reply)
    └─ → Goodbye_And_Hangup

13. Goodbye_And_Hangup (reply)
    └─ END
```

---

## 🛠️ Agent Routing Logic

### Orchestrator Decision (agent-orchestrator.service.ts:305-351)

```typescript
// Get node configuration
const currentNodeConfig = this.dagConfig.nodes.find(n => n.node_name === state.currentNode);
const agentProfileType = currentNodeConfig?.agent_profile_type;

if (agentProfileType === 'worker_mcp_agent') {
  // Execute MCP tool, update context
  const mcpResult = await this.workerMCPAgent.executeNode(state.currentNode, state);
  contextUpdates = mcpResult.contextUpdates;

} else if (agentProfileType === 'worker_reply_agent') {
  // Generate customer-facing response
  const replyResult = await this.workerReplyAgent.executeNode(
    state.currentNode,
    state,
    userMessage
  );
  response = replyResult.response;

} else if (agentProfileType === 'internal') {
  // Skip agent execution (routing node)

} else if (agentProfileType === 'summarizer_agent') {
  // Summarize conversation (TBD)
}
```

---

## 📊 Data Flow Example

### Scenario: User says "Hello, I need help with drywall repair"

```
ITERATION 1:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Node: GREET_CUSTOMER
Agent Type: worker_reply_agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WorkerReplyAgent receives:
   - node.role: "a welcoming customer service representative"
   - node.node_goal: "Greet warmly, invite needs sharing"
   - context: {
       conversation_history: [],
       customer_name: "(not set)",
       customers_main_ask: "(not set)",
       ...
     }
   - userMessage: "Hello, I need help with drywall repair"

2. LLM Prompt:
   You are a welcoming customer service representative.
   Your goal is: Greet warmly...
   You have these datapoints: {...}

   Please reply to customer:

3. WorkerReplyAgent returns:
   { response: "Hello! I understand you need help with drywall repair. Let me assist you." }

4. Orchestrator updates context:
   - Adds response to messages
   - (No context updates from WorkerReplyAgent)

5. NavigatorAgent decides:
   - Checks branching_conditions
   - Customer mentioned issue in first message
   - Decision: next_node_to_go_to = "Identify_Issue"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 2:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Node: Identify_Issue
Agent Type: worker_reply_agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WorkerReplyAgent receives:
   - node.role: "a problem-solving specialist"
   - node.node_goal: "Confirm issue empathetically"
   - context: {
       conversation_history: [
         {customer: "Hello, I need help with drywall repair",
          agent: "Hello! I understand..."}
       ],
       customers_main_ask: "(not set)",  // Will be extracted by separate system
       ...
     }

2. WorkerReplyAgent returns:
   { response: "I see you have drywall that needs patching. Let me find the right solution." }

3. NavigatorAgent decides:
   - next_node_to_go_to = "use_mcp_to_get_info"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 3:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Node: use_mcp_to_get_info
Agent Type: worker_mcp_agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WorkerMCPAgent receives:
   - node.role: "a data-gathering assistant"
   - node.node_goal: "Fetch service catalog, entities"
   - context: {
       customers_main_ask: "drywall repair",
       matching_service_catalog: "(not set)",  // MISSING - needs fetch
       ...
     }
   - availableTools: [setting_list, entity_list, task_create, ...]

2. LLM with function calling:
   You are a data-gathering assistant.
   Your goal is: Fetch service catalog...
   Context shows: matching_service_catalog is missing

   Available tools: setting_list, entity_list, ...

   Please call MCP tool:

3. LLM decides to call:
   setting_list({category: "dl__service_category"})

4. WorkerMCPAgent executes tool, maps results:
   MCP returns: [{name: "Drywall Repair"}, {name: "Painting"}, ...]

   Maps to context:
   { matching_service_catalog_to_solve_customers_issue: "Drywall Repair" }

5. WorkerMCPAgent returns:
   {
     statusMessage: "Let me check that for you",
     contextUpdates: {
       matching_service_catalog_to_solve_customers_issue: "Drywall Repair"
     },
     mcpExecuted: true
   }

6. Orchestrator merges contextUpdates into context.json

7. NavigatorAgent decides:
   - next_node_to_go_to = "Empathize"

... (continues through all nodes until Goodbye)
```

---

## 🔧 Implementation Files

### 1. WorkerReplyAgent (`worker-reply-agent.service.ts`)
- **Purpose**: Generate customer-facing responses only
- **Input**: node.role, node.node_goal, node.prompt_templates, context.json
- **Output**: `{ response: string }`
- **No context updates** - only generates replies

### 2. WorkerMCPAgent (`worker-mcp-agent.service.ts`)
- **Purpose**: Execute MCP tools and update context
- **Input**: node.role, node.node_goal, context.json, available MCP tools
- **Output**: `{ statusMessage: string, contextUpdates: Partial<DAGContext>, mcpExecuted: boolean }`
- **Generates context updates** from MCP tool results

### 3. NavigatorAgent (`navigator-agent.service.ts`)
- **Purpose**: Decide next node based on branching conditions
- **Input**: context.json, current_node.branching_conditions, node_traversal_path
- **Output**: `{ next_node_to_go_to: string, next_course_of_action: string }`

### 4. AgentOrchestrator (`agent-orchestrator.service.ts`)
- **Purpose**: Route to correct agent based on node.agent_profile_type
- **Routing**: Reads `node.agent_profile_type` and calls appropriate agent
- **Context Management**: Merges all updates non-destructively

### 5. Agent Configuration (`agent_config.json`)
- **15 nodes** with complete specifications
- Each node has: `role`, `node_goal`, `prompt_templates`, `agent_profile_type`, `branching_conditions`
- **3 agent profiles**: worker_reply_agent, worker_mcp_agent, node_navigator_agent

---

## ✅ Non-Destructive Context Updates

### Arrays (APPEND ONLY)
```typescript
// ✅ CORRECT
context.summary_of_conversation_on_each_step_until_now.push(newItem);
context.node_traversal_path.push(currentNode);
```

### Scalar Fields (UPDATE IF MEANINGFUL)
```typescript
// ✅ CORRECT
if (newValue !== undefined && newValue !== null && newValue !== '') {
  context.customer_name = newValue;
}
```

### Logging
```
[AgentContext] 💬 Conversation summary appended: 1 item(s), total: 5
[AgentContext] 🗺️  Node path appended: GREET_CUSTOMER, total nodes: 1
[AgentContext] 📝 Field updated: customer_name [NEW]
```

---

## 🚀 Key Benefits

1. **Configuration-Driven**: All behavior in `agent_config.json`
2. **Separation of Concerns**: Reply vs MCP vs Navigation
3. **Type Safety**: Different result types for each agent
4. **Maintainability**: Single responsibility per agent
5. **Flexibility**: Easy to add new nodes or agent types
6. **Scalability**: Node-based routing via Navigator

---

## 📝 Summary

### Architecture Components
- **15 Business Operation Nodes** (states in the flow)
- **3 Agent Types** (reply, MCP, navigator)
- **1 Universal Data Container** (context.json)
- **Non-Destructive Updates** (append arrays, update scalars)
- **Configuration-Driven Routing** (agent_profile_type)

### Complete Flow
```
User Input
  ↓
Orchestrator (checks node.agent_profile_type)
  ↓
Worker Agent (reply OR MCP)
  ├─ WorkerReplyAgent: generates response using node.role + node.goal + context
  └─ WorkerMCPAgent: calls MCP tools, maps results to context
  ↓
Orchestrator (merges contextUpdates)
  ↓
Navigator (decides next_node_to_go_to)
  ↓
Orchestrator (transitions to next node)
  ↓
LOOP
```

---

**Status**: ✅ Complete and Ready for Testing
**Version**: 2.0.0
**Date**: 2025-11-07
