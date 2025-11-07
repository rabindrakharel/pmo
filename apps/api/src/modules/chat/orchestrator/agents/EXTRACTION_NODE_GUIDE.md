# Extract_Customer_Issue Node - Implementation Guide

## 📋 Overview

Created a new **MCP extraction node** that analyzes conversation history and extracts `customers_main_ask` from user messages. This node uses LLM to extract information without calling external tools.

---

## 🎯 Node Configuration

```json
{
  "node_name": "Extract_Customer_Issue",
  "node_action": "mcp",
  "agent_profile_type": "worker_mcp_agent",
  "role": "an information extraction specialist",
  "node_goal": "Extract and structure the customer's main issue from conversation history and update context.customers_main_ask field."
}
```

### Position in Flow

```
1. GREET_CUSTOMER (reply)
   ├─ if issue mentioned → Extract_Customer_Issue
   └─ else → ASK_CUSTOMER_ABOUT_THEIR_NEED

2. ASK_CUSTOMER_ABOUT_THEIR_NEED (reply)
   └─ when issue stated → Extract_Customer_Issue

3. ✅ Extract_Customer_Issue (MCP - extraction)
   └─ → Identify_Issue

4. Identify_Issue (reply)
5. Empathize (reply)
6. Console_Build_Rapport (reply)
7. use_mcp_to_get_info (MCP - external tool)
... (rest of flow)
```

---

## 🔧 How It Works

### 1. Node Type: MCP Extraction Node

Unlike regular MCP nodes that call external tools, extraction nodes:
- ✅ Use LLM to analyze text
- ✅ Extract structured data from conversation
- ✅ Return JSON context updates
- ❌ Do NOT call external APIs/tools
- ❌ Do NOT generate customer-facing responses

### 2. WorkerMCPAgent Enhancement

Added detection logic in `worker-mcp-agent.service.ts`:

```typescript
// Check if this is an extraction node
const isExtractionNode = nodeName === 'Extract_Customer_Issue' ||
                         nodeName.toLowerCase().includes('extract');

if (isExtractionNode) {
  // Handle extraction nodes (analyze conversation, return context updates)
  return await this.executeExtractionNode(nodeName, node, state);
}
```

### 3. Extraction Process

```typescript
private async executeExtractionNode(
  nodeName: string,
  node: any,
  state: AgentContextState
): Promise<WorkerMCPResult> {
  // 1. Build extraction prompt
  const systemPrompt = this.buildExtractionSystemPrompt(node, state.context);

  // 2. Call LLM with jsonMode
  const result = await openaiService.callAgent({
    agentType: 'worker',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Extract information and return JSON' }
    ],
    temperature: 0.1,
    jsonMode: true  // ← Returns structured JSON
  });

  // 3. Parse and return context updates
  const contextUpdates = JSON.parse(result.content);

  return {
    statusMessage: '',  // No customer message
    contextUpdates: { customers_main_ask: "extracted issue" },
    mcpExecuted: true
  };
}
```

### 4. Extraction Prompt Structure

```
You are an information extraction specialist.

Your goal is: Extract customer's main issue from conversation

Conversation history:
[{customer: "Hello, I need drywall repair", agent: "Hello! ..."}]

Current context:
{
  "customers_main_ask": "(not set)",
  "customer_name": "(not set)",
  ...
}

TASK:
1. Analyze the conversation history
2. Extract customers_main_ask
3. Return ONLY valid JSON

Example output:
{
  "customers_main_ask": "Drywall repair needed"
}

Extract now:
```

---

## 📊 Example Flow

### Scenario: User says "Hello, I need help with drywall"

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 1: GREET_CUSTOMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WorkerReplyAgent generates:
   "Hello! I understand you need help with drywall. Let me assist you."

2. Navigator decides:
   - Customer mentioned issue in first message
   - next_node_to_go_to = "Extract_Customer_Issue"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 2: Extract_Customer_Issue
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WorkerMCPAgent detects: isExtractionNode = true

2. Calls executeExtractionNode():
   - Reviews conversation history
   - Extracts issue from "I need help with drywall"

3. LLM returns JSON:
   {
     "customers_main_ask": "Drywall repair assistance needed"
   }

4. WorkerMCPAgent returns:
   {
     statusMessage: "",
     contextUpdates: {
       customers_main_ask: "Drywall repair assistance needed"
     },
     mcpExecuted: true
   }

5. Orchestrator merges into context:
   context.customers_main_ask = "Drywall repair assistance needed"

6. Navigator decides:
   - Extraction successful
   - next_node_to_go_to = "Identify_Issue"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITERATION 3: Identify_Issue
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WorkerReplyAgent reads context:
   - customers_main_ask: "Drywall repair assistance needed"

2. Generates response:
   "I see you need drywall repair. Let me find the right solution for you."

... (continues with Empathize, Console_Build_Rapport, etc.)
```

---

## 🔑 Key Benefits

### 1. Separation of Concerns
- **Reply nodes**: Generate customer responses only
- **Extraction nodes**: Extract data from conversation
- **Tool nodes**: Call external APIs/tools

### 2. Mandatory Field Population
- Ensures `customers_main_ask` is extracted and populated
- Happens BEFORE Identify_Issue node
- Navigator can verify field is populated before proceeding

### 3. Flexible Extraction
- Can extract multiple fields at once
- Can add more extraction nodes for other fields:
  - `Extract_Customer_Data` (name, phone)
  - `Extract_Service_Details` (location, urgency)
  - `Extract_Technical_Info` (model numbers, specs)

### 4. No Customer-Facing Output
- Extraction happens silently
- Customer doesn't see "Extracting information..."
- Seamless flow from user's perspective

---

## 🚀 Adding More Extraction Nodes

### Template for New Extraction Node

```json
{
  "node_name": "Extract_Customer_Data",
  "node_action": "mcp",
  "agent_profile_type": "worker_mcp_agent",
  "role": "a customer data extraction specialist",
  "node_goal": "Extract customer name and phone number from conversation",
  "prompt_templates": "Extract customer_name and customer_phone_number from conversation. Return JSON: {customer_name: '...', customer_phone_number: '...'}",
  "expected_context_fields": ["customer_name", "customer_phone_number"],
  "default_next_node": "Check_IF_existing_customer"
}
```

### Detection Logic

WorkerMCPAgent automatically detects extraction nodes:

```typescript
const isExtractionNode = nodeName === 'Extract_Customer_Issue' ||
                         nodeName === 'Extract_Customer_Data' ||
                         nodeName.toLowerCase().includes('extract');
```

---

## ✅ Updated Flow Summary

### Complete 16-Node Flow

```
1.  GREET_CUSTOMER (reply)
2.  ASK_CUSTOMER_ABOUT_THEIR_NEED (reply)
3.  ✅ Extract_Customer_Issue (MCP - extraction) ← NEW!
4.  Identify_Issue (reply)
5.  Empathize (reply)
6.  Console_Build_Rapport (reply)
7.  use_mcp_to_get_info (MCP - external tool)
8.  Try_To_Gather_Customers_Data (reply)
9.  Check_IF_existing_customer (MCP - external tool)
10. Plan (MCP - external tool)
11. Communicate_To_Customer_Before_Action (reply)
12. Execute_Plan_Using_MCP (MCP - external tool)
13. Tell_Customers_Execution (reply)
14. Goodbye_And_Hangup (reply)
15. wait_for_customers_reply (internal)
16. summarize_the_conversation... (summarizer)
```

### MCP Node Types

| Type | Example Node | Purpose |
|------|-------------|---------|
| **Extraction** | Extract_Customer_Issue | Analyze conversation, extract data |
| **Tool** | use_mcp_to_get_info | Call external APIs/tools |
| **Tool** | Check_IF_existing_customer | Create/lookup records |
| **Tool** | Plan | Create tasks, assign employees |
| **Tool** | Execute_Plan_Using_MCP | Book calendars, finalize |

---

## 📝 Implementation Files Modified

✅ `agent_config.json` - Added Extract_Customer_Issue node
✅ `worker-mcp-agent.service.ts` - Added extraction logic
✅ `GREET_CUSTOMER` branching - Routes to extraction node
✅ `ASK_CUSTOMER_ABOUT_THEIR_NEED` branching - Routes to extraction node

---

## 🧪 Testing Checklist

- [ ] Test extraction when issue mentioned in first message
- [ ] Test extraction after ASK_CUSTOMER_ABOUT_THEIR_NEED
- [ ] Verify customers_main_ask populated correctly
- [ ] Verify no customer-facing output from extraction node
- [ ] Test extraction failure handling (routes back to ASK_NEED)
- [ ] Test with various issue descriptions (drywall, HVAC, lawn, etc.)

---

**Status**: ✅ Complete and Ready for Testing
**Date**: 2025-11-07
**Version**: 2.1.0 - Extraction Nodes Added
