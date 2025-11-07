# LLM-Driven DAG Architecture

## 🧠 **Paradigm Shift: From Rules to Intelligence**

This document describes the **LLM-driven DAG architecture** where the Large Language Model (LLM) controls all conversation flow decisions and context updates through intelligent analysis and tool calls, **replacing rule-based keyword matching** with true AI reasoning.

---

## 🎯 **Core Philosophy**

### **Traditional Approach (Rule-Based)**
```
IF message.includes('actually') THEN
  reset_flags()
  goto Identify_Issue
END IF

IF context.phone === '' THEN
  goto Gather_Data
END IF
```

### **LLM-Driven Approach (Intelligence-Based)**
```
LLM analyzes:
  - Full context JSON
  - User's message
  - Conversation history
  - Current flags and state

LLM decides:
  - What context fields to update (via update_context tool)
  - Which node to execute next (via decide_next_node tool)
  - When to reset flags (based on intent analysis)
  - When to wait for user input
```

**Key Difference:** The LLM **understands context** rather than matching keywords.

---

## 🏗️ **Architecture Components**

### **1. Context Update Tool** (`dag-context-tools.service.ts`)

**Purpose:** Allows LLM to modify any field in the context JSON via tool calls

**Tool Definition:**
```typescript
{
  name: 'update_context',
  description: 'Update conversation context JSON',
  parameters: {
    field_name: 'customer_name' | 'customers_main_ask' | 'flags.greet_flag' | ...,
    field_value: string,
    reason: string  // Why this update
  }
}
```

**Example LLM Tool Call:**
```json
{
  "tool_name": "update_context",
  "arguments": {
    "field_name": "customers_main_ask",
    "field_value": "grass is brown and patchy, needs landscaping",
    "reason": "Extracted main issue from user message"
  }
}
```

**What Happens:**
1. LLM analyzes user message: "My backyard grass is all brown and patchy"
2. LLM calls `update_context` tool with extracted issue
3. Context JSON updated: `customers_main_ask = "grass is brown and patchy, needs landscaping"`
4. Flag updated: `flags.identify_issue_flag = 1`

**Fields LLM Can Update:**
- **Customer Data:** `customer_name`, `customer_phone_number`, `customer_email`, `customer_address`, `customer_id`
- **Issue Data:** `customers_main_ask`, `matching_service_catalog_to_solve_customers_issue`, `related_entities_for_customers_ask`
- **Planning Data:** `task_id`, `appointment_details`, `next_steps_plans_help_customer`
- **Execution Data:** `execution_results`
- **Flags:** All 15 flags (greet_flag, identify_issue_flag, data_phone_flag, etc.)

---

### **2. LLM-Based Router** (`dag-llm-router.service.ts`)

**Purpose:** LLM analyzes context and decides which node to execute next

**Routing Decision Tool:**
```typescript
{
  name: 'decide_next_node',
  description: 'Analyze context and decide next node',
  parameters: {
    next_node: 'GREET_CUSTOMER' | 'Identify_Issue' | 'Try_To_Gather_Customers_Data' | ...,
    reason: string,
    skip_reason: string  // If skipping nodes
  }
}
```

**Example LLM Routing Decision:**
```json
{
  "tool_name": "decide_next_node",
  "arguments": {
    "next_node": "Empathize",
    "reason": "Issue identified and customers_main_ask is set. Empathy not shown yet (empathize_flag=0).",
    "skip_reason": "Skipped GREET (greet_flag=1), ASK_NEED (ask_need_flag=1), IDENTIFY (identify_issue_flag=1)"
  }
}
```

**Router System Prompt (Excerpt):**
```
You are an intelligent conversation flow router.

Analyze the context and decide which node should execute next.

Core Principles:
1. Skip nodes if their flag is already set to 1
2. If customer changes their issue, reset issue-related flags and route to Identify_Issue
3. Prioritize collecting mandatory fields: customers_main_ask and customer_phone_number
4. Use END when waiting for user response

Current Context: { flags: {...}, customers_main_ask: "...", ...}
Last User Message: "..."

Use decide_next_node tool to make your decision.
```

**What Happens:**
1. LLM receives current node, context JSON, and last user message
2. LLM analyzes: Which steps are complete? What's missing? Did intent change?
3. LLM calls `decide_next_node` tool with decision
4. Graph executes chosen node

---

### **3. Updated dag.json** (LLM Instructions Included)

**New Structure:**
```json
{
  "llm_framework_instructions": {
    "architecture": "LLM-Driven Conversational AI",
    "your_role": "You control everything through context analysis and tool calls",
    "core_principles": [
      "CONTEXT IS EVERYTHING",
      "TOOL-BASED UPDATES",
      "LLM-BASED ROUTING",
      "NON-DESTRUCTIVE",
      "MANDATORY FIELDS",
      "FLAG-DRIVEN"
    ],
    "example_flow": { ... }
  },
  "routing_config": {
    "llm_routing_instructions": "Use decide_next_node tool...",
    "llm_context_update_instructions": "Use update_context tool...",
    "routing_hints": {
      "issue_change_indicators": "User says 'actually' → reset flags and route to Identify_Issue",
      "data_update_indicators": "User says 'change phone' → reset data_phone_flag",
      ...
    }
  }
}
```

**LLM Reads These Instructions** and uses them to make intelligent decisions.

---

## 🔄 **How It Works: End-to-End Flow**

### **Scenario: Customer Changes Issue Mid-Conversation**

**Messages:**
1. User: "I need help with my brown grass"
2. Agent: "I understand, let me help with that landscaping issue"
3. User: **"Actually, I need plumbing help instead"** ← Intent change

**Traditional (Rule-Based) Approach:**
```typescript
// Hardcoded keyword check
if (message.includes('actually') || message.includes('instead')) {
  context.identify_issue_flag = 0;
  context.empathize_flag = 0;
  context.plan_flag = 0;
  return 'Identify_Issue';
}
```
**Problem:** Brittle. Misses variations like "wait, different problem", "on second thought", etc.

**LLM-Driven Approach:**
```
Step 1: LLM analyzes message "Actually, I need plumbing help instead"

Step 2: LLM reasoning:
"User is changing their main issue from grass/landscaping to plumbing.
I should:
1. Reset issue-related flags (identify_issue_flag, empathize_flag, plan_flag)
2. Clear previous issue data
3. Route back to Identify_Issue to re-extract"

Step 3: LLM makes tool calls:
  Call 1: update_context(field='flags.identify_issue_flag', value='0', reason='User changed issue')
  Call 2: update_context(field='flags.empathize_flag', value='0', reason='Reset empathy for new issue')
  Call 3: update_context(field='flags.plan_flag', value='0', reason='Plan invalid for new issue')
  Call 4: update_context(field='customers_main_ask', value='', reason='Clear old issue')

Step 4: Router LLM decides next node:
  Call: decide_next_node(next_node='Identify_Issue', reason='User changed issue, need to re-identify')

Step 5: Identify_Issue node executes:
  LLM extracts: "plumbing help"
  Call: update_context(field='customers_main_ask', value='plumbing help', reason='Extracted new issue')
  Call: update_context(field='matching_service_catalog', value='Plumbing', reason='Matched service')
  Call: update_context(field='flags.identify_issue_flag', value='1', reason='Issue identified')
```

**Advantages:**
- ✅ Understands intent regardless of exact wording
- ✅ Makes intelligent decisions about what to reset
- ✅ Provides reasoning for every action
- ✅ Adapts to conversation nuances

---

## 📊 **Context JSON: The Single Source of Truth**

Everything is stored in context JSON. LLM reads it, analyzes it, and updates it.

**Example Context JSON:**
```json
{
  "who_are_you": "You are a polite customer service agent",
  "customer_name": "Sarah Johnson",
  "customer_phone_number": "647-555-9876",
  "customer_id": "cust-12345",
  "customers_main_ask": "grass is brown and patchy, needs landscaping",
  "matching_service_catalog_to_solve_customers_issue": "Landscaping",
  "related_entities_for_customers_ask": ["task-789", "appointment-101"],
  "task_id": "task-789",
  "appointment_details": "2025-11-10 2pm, landscaping service",
  "next_steps_plans_help_customer": "1. Assess lawn condition 2. Apply treatment 3. Schedule follow-up",
  "execution_results": "Booking created: BOOK-456",
  "summary_of_conversation_on_each_step_until_now": [
    {"customer": "grass issue", "agent": "empathy shown"},
    {"customer": "phone: 647-555-9876", "agent": "phone collected"}
  ],
  "flags": {
    "greet_flag": 1,
    "ask_need_flag": 1,
    "identify_issue_flag": 1,
    "empathize_flag": 1,
    "rapport_flag": 1,
    "data_name_flag": 1,
    "data_phone_flag": 1,
    "data_email_flag": 0,
    "data_address_flag": 0,
    "check_customer_flag": 1,
    "plan_flag": 1,
    "communicate_plan_flag": 0,
    "execute_flag": 0,
    "tell_execution_flag": 0,
    "goodbye_flag": 0
  }
}
```

**LLM's View:**
- "I can see customer data is collected (name, phone)"
- "Issue is identified and empathized (flags = 1)"
- "Plan is created but not yet communicated (communicate_plan_flag = 0)"
- "Next step: Communicate_To_Customer_Before_Action"

---

## 🔧 **LLM Tool Calling Workflow**

### **Node Execution with Tools**

**Every node gives LLM:**
1. **Current context JSON** (full state)
2. **User's latest message** (if any)
3. **update_context tool** (to modify context)
4. **Node prompt** (what this node should accomplish)

**LLM's Job:**
1. Analyze context and message
2. Decide what to update
3. Call tools to update context
4. Generate response (if customer-facing node)

**Example: Identify_Issue Node**

**Input to LLM:**
```
You are at node: Identify_Issue

Current Context:
{
  "flags": {"greet_flag": 1, "ask_need_flag": 1, "identify_issue_flag": 0},
  "customers_main_ask": "",
  ...
}

User Message: "My backyard grass is all brown and patchy, I think I need landscaping help"

Your Task:
Extract the customer's main issue and update context. Use update_context tool to set:
- customers_main_ask
- matching_service_catalog_to_solve_customers_issue
- flags.identify_issue_flag = 1

Available Tools: update_context
```

**LLM's Response (Tool Calls):**
```json
[
  {
    "tool": "update_context",
    "args": {
      "field_name": "customers_main_ask",
      "field_value": "grass is brown and patchy, needs professional landscaping",
      "reason": "Extracted main issue from user message"
    }
  },
  {
    "tool": "update_context",
    "args": {
      "field_name": "matching_service_catalog_to_solve_customers_issue",
      "field_value": "Landscaping",
      "reason": "Matched issue to Landscaping service category"
    }
  },
  {
    "tool": "update_context",
    "args": {
      "field_name": "flags.identify_issue_flag",
      "field_value": "1",
      "reason": "Issue successfully identified"
    }
  }
]
```

**Result:**
- Context updated with extracted issue
- Flag set to 1 (prevents re-extraction)
- Router can now proceed to next node

---

## 🆚 **Comparison: Rule-Based vs LLM-Driven**

| Aspect | Rule-Based | LLM-Driven |
|--------|------------|------------|
| **Intent Detection** | Keyword matching ("actually", "instead") | Semantic understanding ("on second thought", "wait, different problem") |
| **Context Updates** | Hardcoded in node functions | LLM decides via tool calls |
| **Routing Logic** | IF-ELSE statements | LLM analysis with reasoning |
| **Adaptability** | Requires code changes for new patterns | Learns from instructions in dag.json |
| **Error Handling** | Must anticipate all edge cases | LLM adapts to unexpected inputs |
| **Transparency** | Hidden in code | LLM provides reasons for decisions |
| **Maintenance** | Update keyword lists and logic | Update dag.json instructions |
| **Context Preservation** | Manual merge logic | LLM intelligently updates only necessary fields |

---

## 🎯 **Benefits of LLM-Driven Architecture**

### **1. Intelligence Over Rules**
- **Understands variations:** "actually", "on second thought", "wait, different issue" all detected
- **Context-aware:** Knows when to reset flags based on conversation flow
- **Adaptive:** Handles unexpected user inputs gracefully

### **2. True Non-Destructive Updates**
- LLM only updates fields that need changing
- Preserves existing context automatically
- Example: User provides phone → LLM updates `customer_phone_number` and `flags.data_phone_flag` only

### **3. Transparent Decision-Making**
- Every tool call includes a `reason` parameter
- Router decisions include `reason` and `skip_reason`
- Easy to debug: just read LLM's reasoning

### **4. Configuration-Driven**
- All LLM instructions in dag.json
- Change behavior by editing instructions, not code
- Example: Add new routing hint → LLM adapts immediately

### **5. Self-Documenting**
- Tool call logs show exactly what LLM did
- Reasons explain why each decision was made
- Context JSON is the complete conversation state

### **6. Scalable**
- Add new context fields → LLM learns from schema
- Add new nodes → Update dag.json, no code changes
- Add new routing patterns → Add to routing_hints

---

## 📝 **Implementation Status**

### **✅ Completed:**
1. **Context Update Tool** (`dag-context-tools.service.ts`)
   - Tool definition for LLM
   - Execution logic for context updates
   - Support for all 15 flags and all context fields

2. **LLM-Based Router** (`dag-llm-router.service.ts`)
   - Routing decision tool for LLM
   - System prompts for intelligent routing
   - Fallback logic if LLM fails

3. **Updated dag.json**
   - LLM framework instructions at top
   - Routing hints for common patterns
   - Context update instructions
   - Example flow for LLM to learn from

### **🚧 Remaining:**
1. **Node Executor** - Execute nodes with LLM tool calling
2. **MCP Integration** - Connect LLM tool calls to MCP tools
3. **Orchestrator Integration** - Replace hardcoded nodes
4. **End-to-End Testing** - Validate LLM-driven flow

---

## 🚀 **Next Steps**

### **Phase 1: Node Executor with Tool Calling**
Create executor that:
- Loads node prompt from dag.json
- Gives LLM: context + message + update_context tool
- Processes LLM's tool calls to update context
- Returns updated context + response

### **Phase 2: MCP Tool Integration**
Enable LLM to:
- Call MCP tools directly (customer_search, booking_create, etc.)
- Fetch data (service catalog, customer profile, etc.)
- Update context with fetched data

### **Phase 3: Full Integration**
- Replace hardcoded nodes in langgraph-state-graph.service.ts
- Use LLM router for all routing decisions
- Test backyard grass scenario end-to-end

---

## 💡 **Example: Complete Interaction**

**User:** "Hi, my grass is brown"

**LLM at GREET node:**
```
Tool Calls:
- update_context(field='flags.greet_flag', value='1', reason='Greeting complete')
Response: "Hello! I'm here to help you."
```

**Router LLM:**
```
Analysis: greet_flag=1 (done), ask_need_flag=0 (not done)
Tool Call: decide_next_node(next_node='ASK_CUSTOMER_ABOUT_THEIR_NEED', reason='Need to ask about customer's need')
```

**LLM at ASK_NEED node:**
```
Tool Calls:
- update_context(field='flags.ask_need_flag', value='1', reason='Asked about need')
Response: "What brings you here today?"
```

**User:** "My grass is brown"

**Router LLM:**
```
Analysis: User provided need in response. Route to identify issue.
Tool Call: decide_next_node(next_node='Identify_Issue', reason='User provided issue information')
```

**LLM at IDENTIFY node:**
```
Tool Calls:
- update_context(field='customers_main_ask', value='grass is brown, needs landscaping', reason='Extracted issue')
- update_context(field='matching_service_catalog', value='Landscaping', reason='Matched service')
- update_context(field='flags.identify_issue_flag', value='1', reason='Issue identified')
Response: "I understand you're having issues with your grass."
```

**...and so on**

---

## 🎓 **Key Takeaway**

**The LLM is now the intelligent controller.** It:
- ✅ Analyzes context to make decisions
- ✅ Updates context via tool calls
- ✅ Routes conversation intelligently
- ✅ Adapts to user intent changes
- ✅ Preserves context non-destructively
- ✅ Provides reasoning for every action

**No more hardcoded rules. Just intelligent AI reasoning.**

---

**Last Updated:** 2025-11-07
**Architecture:** LLM-Driven DAG with Tool-Based Context Updates
**Status:** Core components complete (60%), integration pending
