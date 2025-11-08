# 🔴 Critical Bugs Found in Production

> **Status:** 🚨 CRITICAL - System is non-functional
>
> **Date Found:** 2025-11-08
> **Severity:** HIGH - Infinite loops, data loss, unusable

---

## 🔴 Bug #1: Phone Number Extraction Failing

### **Evidence:**
```json
User said: "My phone number is 647-646-7446"

Context shows:
"data_extraction_fields": {
  "customer_name": "Janssen",          ✅ Extracted
  "customer_phone_number": "",         ❌ NOT EXTRACTED
}
```

### **Impact:**
- Customer provides phone number
- DataExtractionAgent fails to extract it
- Navigator sees `customer_phone_number` is still empty
- System loops back to `Try_To_Gather_Customers_Data`
- **Infinite loop** - customer keeps getting asked for phone number

### **Root Cause:**
Unknown - needs investigation. Possible causes:
1. DataExtractionAgent prompt not working
2. LLM not calling updateContext tool
3. Tool execution failing silently
4. Conversation summary corruption (see Bug #2)

### **How to Reproduce:**
1. Start chat: "My roof is leaking"
2. Provide name: "Janssen"
3. Provide phone: "647-646-7446"
4. System loops asking for phone number again

---

## 🔴 Bug #2: Massive Conversation Summary Duplication

### **Evidence:**
```json
"summary_of_conversation_on_each_step_until_now": [
  // Same 5 exchanges repeated ~10 times
  {"customer": "Hey, are you the assistant?", "agent": "Hello..."},
  {"customer": "Roof. Roof and roo.", "agent": "It seems..."},
  {"customer": "The roof has holes.", "agent": "I understand..."},
  {"customer": "Hey, are you the assistant?", "agent": "Hello..."},  // DUPLICATE
  {"customer": "Roof. Roof and roo.", "agent": "It seems..."},       // DUPLICATE
  {"customer": "The roof has holes.", "agent": "I understand..."},   // DUPLICATE
  // ... 60+ entries when should be 6 unique exchanges
]
```

### **Impact:**
- Conversation history grows exponentially
- Same exchanges repeated ~10 times
- DataExtractionAgent analyzes duplicate data
- LLM gets confused by noise
- Performance degrades
- Context limit reached quickly

### **Root Cause:**
Conversation summary append logic issue. Code shows:

```typescript
// Line 547 in agent-orchestrator.service.ts
if (iterations === 1 && userMessage && response) {
  const currentSummary = state.context.summary_of_conversation_on_each_step_until_now || [];
  state = this.contextManager.updateContext(state, {
    summary_of_conversation_on_each_step_until_now: [
      ...currentSummary,
      {
        customer: userMessage,
        agent: response
      }
    ]
  });
}
```

**Problem:** Only appends on `iterations === 1`, but something is causing duplicates.

**Possible Causes:**
1. State being loaded from file has old duplicates
2. Multiple processes appending simultaneously
3. State merge logic duplicating arrays
4. Context reload from database includes duplicates

---

## 🔴 Bug #3: Node Infinite Loop

### **Evidence:**
```json
"node_traversed": [
  "GREET_CUSTOMER",
  "ASK_CUSTOMER_ABOUT_THEIR_NEED",
  "ASK_CUSTOMER_ABOUT_THEIR_NEED",        // Duplicate
  "Extract_Customer_Issue",
  "Acknowledge_And_Empathize",
  "Try_To_Gather_Customers_Data",
  "Try_To_Gather_Customers_Data",          // Loop!
  "Try_To_Gather_Customers_Data",
  "Try_To_Gather_Customers_Data",
  "Try_To_Gather_Customers_Data"
]
```

### **Impact:**
- System stuck in `Try_To_Gather_Customers_Data` loop
- Customer can never proceed past data collection
- Unusable system

### **Root Cause:**
Cascading failure:
1. Phone number extraction fails (Bug #1)
2. Navigator sees `customer_phone_number` is empty
3. Matches condition: "if required customer data is missing"
4. Routes back to `Try_To_Gather_Customers_Data`
5. User provides phone number again
6. Extraction fails again (Bug #1)
7. **Infinite loop**

### **Missing Safeguard:**
No max retry limit for same node. Code should prevent:
- More than 3 consecutive visits to same node
- Infinite loops in data collection

---

## 🔴 Bug #4: Related Entities Field Misuse

### **Evidence:**
```json
"data_extraction_fields": {
  "customers_main_ask": "Roof issues",
  "related_entities_for_customers_ask": "holes in roof"  // ❌ WRONG!
}
```

### **Impact:**
- `related_entities_for_customers_ask` should contain PMO entity IDs (projects, tasks)
- Instead contains issue description ("holes in roof")
- Field definition states: "Related PMO entities (projects, tasks, employees)"

### **Expected:**
```json
"customers_main_ask": "Roof repair - holes in roof",
"related_entities_for_customers_ask": ""  // Empty until entities are linked
```

Or:
```json
"customers_main_ask": "Roof repair",
"related_entities_for_customers_ask": "[{id: 'proj-1', name: 'Roof Repair Project'}]"
```

### **Root Cause:**
DataExtractionAgent extracting wrong data into wrong field. Prompt needs clarification on field purposes.

---

## 📊 Session Statistics (Broken)

```json
"statistics": {
  "totalMessages": 14,                   // Should be 6 user + 8 agent
  "userMessages": 6,                     // ✅ Correct
  "assistantMessages": 8,                // ✅ Correct
  "nodesTraversed": 10,                  // ❌ Should be 6 unique nodes
  "flagsSet": 0                          // ❌ Should have flags set
}
```

**Issues:**
- `nodesTraversed` counts duplicates (should be unique)
- `flagsSet` is 0 when flags should be set (greet_flag, etc.)

---

## 🔍 Recommended Fixes

### **Fix #1: Debug Phone Number Extraction**

**Add logging to DataExtractionAgent:**
```typescript
// After LLM call
console.log('[DEBUG] LLM tool_calls:', JSON.stringify(result.tool_calls, null, 2));
console.log('[DEBUG] Last 4 exchanges analyzed:', JSON.stringify(last4Exchanges, null, 2));
console.log('[DEBUG] Empty fields:', emptyFields);
```

**Test with simple case:**
```
User: "My phone number is 555-1234"
Expected: customer_phone_number = "555-1234"
Actual: ?
```

---

### **Fix #2: Prevent Conversation Summary Duplication**

**Add deduplication check:**
```typescript
// Before appending
const currentSummary = state.context.summary_of_conversation_on_each_step_until_now || [];

// Check if last entry is same as what we're adding
const lastEntry = currentSummary[currentSummary.length - 1];
if (lastEntry?.customer === userMessage && lastEntry?.agent === response) {
  console.log('[AgentOrchestrator] ⚠️ Skipping duplicate conversation entry');
  return; // Don't append duplicate
}

// Append new entry
state = this.contextManager.updateContext(state, {
  summary_of_conversation_on_each_step_until_now: [
    ...currentSummary,
    { customer: userMessage, agent: response }
  ]
});
```

**Also check:**
- Is state being loaded from file AND database?
- Are both sources causing duplicates?
- Is there a race condition?

---

### **Fix #3: Add Loop Detection**

**Add safeguard in agent-orchestrator.service.ts:**
```typescript
// After navigator decides next node
const recentNodes = state.context.node_traversed.slice(-5);
const sameNodeCount = recentNodes.filter(n => n === navigatorDecision.nextNode).length;

if (sameNodeCount >= 3) {
  console.error(`[AgentOrchestrator] 🚨 LOOP DETECTED: ${navigatorDecision.nextNode} visited 3+ times`);

  // Force escape: skip to next logical node
  if (navigatorDecision.nextNode === 'Try_To_Gather_Customers_Data') {
    console.log(`[AgentOrchestrator] 🔧 Forcing escape to Check_IF_existing_customer`);
    navigatorDecision.nextNode = 'Check_IF_existing_customer';
  } else {
    // Generic escape: go to next node in flow
    console.log(`[AgentOrchestrator] 🔧 Forcing escape to default_next_node`);
    const currentNodeConfig = this.dagConfig.nodes.find(n => n.node_name === state.currentNode);
    if (currentNodeConfig?.default_next_node) {
      navigatorDecision.nextNode = currentNodeConfig.default_next_node;
    }
  }
}
```

---

### **Fix #4: Clarify Field Purposes**

**Update DataExtractionAgent prompt (line 156-238):**
```typescript
Example 3 - Issue with details:
Conversation:
Customer: "The roof has holes that need patching"
Agent: "I can help with that"

→ Call: updateContext({
  "customers_main_ask": "Roof repair - holes need patching"
  // NOTE: related_entities_for_customers_ask is for PMO entity IDs, not issue details!
})

⚠️ FIELD CLARIFICATIONS:
- customers_main_ask: Customer's issue/request in their words
- related_entities_for_customers_ask: PMO entity IDs (e.g., existing project/task IDs)
  → Only populate this if customer mentions specific project/task IDs
  → Do NOT put issue descriptions here
```

---

### **Fix #5: Enable Debug Mode**

**Add to agent_config.json:**
```json
{
  "debug_mode": {
    "enabled": true,
    "log_data_extraction": true,
    "log_tool_calls": true,
    "log_context_updates": true,
    "break_on_loop": true,
    "max_same_node_visits": 3
  }
}
```

---

## 🧪 Testing Required

### **Test Case 1: Simple Phone Extraction**
```
User: "My phone is 555-1234"
Expected: customer_phone_number = "555-1234"
```

### **Test Case 2: All Data Upfront**
```
User: "My roof is leaking, I'm John, 555-1234"
Expected:
  - customer_name = "John"
  - customer_phone_number = "555-1234"
  - customers_main_ask = "Roof leak repair"
```

### **Test Case 3: No Duplication**
```
After 5 user messages:
Expected: summary has 5 unique exchanges
NOT: 50+ duplicate exchanges
```

### **Test Case 4: No Infinite Loops**
```
User provides all required data
Expected: Moves to Check_IF_existing_customer
NOT: Loops in Try_To_Gather_Customers_Data
```

---

## 📝 Investigation Checklist

- [ ] Add debug logging to DataExtractionAgent
- [ ] Check if LLM is calling updateContext tool
- [ ] Check tool execution success/failure
- [ ] Verify conversation summary append logic
- [ ] Check state load/save for duplication sources
- [ ] Add loop detection safeguard
- [ ] Test phone number extraction patterns
- [ ] Verify field purposes in prompts
- [ ] Check database vs file persistence conflicts

---

## 🚨 Priority

**CRITICAL - IMMEDIATE FIX REQUIRED**

1. **P0:** Fix phone number extraction (Bug #1) - System is unusable
2. **P0:** Add loop detection (Bug #3) - Prevents infinite loops
3. **P1:** Fix conversation duplication (Bug #2) - Degrades performance
4. **P2:** Fix field misuse (Bug #4) - Data quality issue

---

**Last Updated:** 2025-11-08
**Reporter:** AI Code Analysis
**Session ID:** 8e5465d2-7a7a-40e7-aa72-bcaa78e912be
