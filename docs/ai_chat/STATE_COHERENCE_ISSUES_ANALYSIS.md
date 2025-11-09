# State Coherence Issues - Analysis & Proposed Fixes

**Date:** 2025-11-09
**Severity:** HIGH - Multiple critical state management issues affecting conversation flow
**Impact:** Poor user experience, duplicate data, incorrect context, race conditions

---

## Executive Summary

The AI chat system exhibits **7 critical state management issues** affecting data coherence, conversation flow, and system reliability. These issues range from race conditions in session creation to duplicate data in conversation history and stale context propagation.

---

## Issue #1: Duplicate Node Traversal & Conversation Summaries

### Problem
The `node_traversed` and `summary_of_conversation_on_each_step_until_now` arrays contain duplicate entries:

```json
"node_traversed": [
  "GREET_CUSTOMER",
  "ASK_CUSTOMER_ABOUT_THEIR_NEED",
  "ASK_CUSTOMER_ABOUT_THEIR_NEED",  // ❌ DUPLICATE
  "wait_for_customers_reply",
  "wait_for_customers_reply"  // ❌ DUPLICATE
]

"summary_of_conversation_on_each_step_until_now": [
  {
    "index": 0,  // ❌ DUPLICATE INDEX
    "customer": "Hey, roof, roof, and roof.",
    "agent": "Hello! It sounds like you might have some roofing concerns..."
  },
  {
    "index": 0",  // ❌ SAME INDEX AGAIN
    "customer": "Hey, roof, roof, and roof.",
    "agent": "Hello! It sounds like you might have some roofing concerns..."
  }
]
```

### Root Cause
**File:** `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`

The orchestrator is calling `updateCurrentNode()` and `appendConversationSummary()` multiple times for the same node transition:

1. After WorkerReplyAgent executes → appends node + summary
2. After DataExtractionAgent executes → appends node + summary AGAIN (same data)
3. After NavigatorAgent executes → appends node + summary AGAIN (same data)

### Impact
- **Medium-High Severity**
- Inflated context size (token waste)
- Confused state tracking
- Incorrect conversation indexing
- Difficulty debugging conversation flow

### Proposed Fix

**Location:** `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts:450-550`

**Strategy:** Only append node/summary ONCE per user message, not after every sub-agent execution.

```typescript
// ❌ CURRENT (WRONG): Appends after every agent
async processMessage(sessionId: string, userMessage: string) {
  // ... worker reply agent ...
  this.contextManager.updateCurrentNode(state, nodeName);  // Appends 1st time
  this.contextManager.appendConversationSummary(state, ...);  // Appends 1st time

  // ... data extraction agent ...
  this.contextManager.updateCurrentNode(state, nodeName);  // ❌ Appends 2nd time (duplicate!)
  this.contextManager.appendConversationSummary(state, ...);  // ❌ Appends 2nd time (duplicate!)

  // ... navigator agent ...
  this.contextManager.updateCurrentNode(state, nodeName);  // ❌ Appends 3rd time (duplicate!)
}

// ✅ PROPOSED FIX: Append only at specific lifecycle points
async processMessage(sessionId: string, userMessage: string) {
  // 1. Worker generates response
  const response = await workerAgent.execute(...);

  // 2. Data extraction (updates context fields, NO node append)
  await dataExtractionAgent.extract(...);

  // 3. Append conversation ONCE after response is finalized
  this.contextManager.appendConversationSummary(state, userMessage, response);

  // 4. Navigator decides next node
  const nextNode = await navigatorAgent.decide(...);

  // 5. Update node ONCE during actual transition
  if (nextNode !== state.currentNode) {
    this.contextManager.updateCurrentNode(state, nextNode);
  }
}
```

**Implementation Steps:**
1. Add `hasAppendedConversation` flag to prevent duplicate appends in same turn
2. Move `updateCurrentNode()` call to ONLY happen during actual node transitions (not after every agent)
3. Move `appendConversationSummary()` to happen ONCE after response is finalized

---

## Issue #2: Session Number Generation Race Condition

### Problem
```
[StateManager] Session number conflict (attempt 1/5), retrying...
```

When multiple sessions are created concurrently, they can generate the same `session_number` value, causing unique constraint violations.

### Root Cause
**File:** `apps/api/src/modules/chat/orchestrator/state/state-manager.service.ts:568-578`

```typescript
private async generateSessionNumber(): Promise<string> {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const result = await client`
    SELECT COUNT(*) as count
    FROM app.orchestrator_session
    WHERE session_number LIKE ${'ORCH-' + today + '%'}
  `;

  const count = parseInt(result[0].count) + 1;
  return `ORCH-${today}-${count.toString().padStart(4, '0')}`;
  // ❌ RACE CONDITION: Two concurrent calls can get same count value
}
```

**Scenario:**
1. Session A: Query returns count=5, generates `ORCH-20251109-0006`
2. Session B: Query returns count=5 (before A commits), generates `ORCH-20251109-0006` ❌ DUPLICATE
3. One session succeeds, other retries up to 5 times

### Impact
- **Low-Medium Severity**
- Delays session creation (50-250ms retry backoff)
- Unnecessary database queries (5 attempts)
- Log noise

### Proposed Fix

**Location:** `apps/api/src/modules/chat/orchestrator/state/state-manager.service.ts:568-578`

**Strategy:** Use atomic PostgreSQL sequence for session numbering.

```sql
-- Create sequence for session numbers
CREATE SEQUENCE IF NOT EXISTS app.orchestrator_session_number_seq;

-- Migration script (run once)
-- Reset sequence to current max + 1
SELECT setval('app.orchestrator_session_number_seq',
  (SELECT COALESCE(MAX(CAST(SUBSTRING(session_number FROM '\d+$') AS INTEGER)), 0) + 1
   FROM app.orchestrator_session));
```

```typescript
// ✅ FIX: Use atomic sequence (no race condition)
private async generateSessionNumber(): Promise<string> {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

  // Atomic increment (safe for concurrent access)
  const result = await client`
    SELECT nextval('app.orchestrator_session_number_seq') as next_num
  `;

  const num = parseInt(result[0].next_num);
  return `ORCH-${today}-${num.toString().padStart(4, '0')}`;
}
```

**Alternative Fix (if sequences not preferred):**
Use PostgreSQL advisory locks:
```typescript
private async generateSessionNumber(): Promise<string> {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

  // Acquire advisory lock (released automatically at transaction end)
  await client`SELECT pg_advisory_lock(hashtext('session_number_gen'))`;

  try {
    const result = await client`
      SELECT COUNT(*) as count
      FROM app.orchestrator_session
      WHERE session_number LIKE ${'ORCH-' + today + '%'}
    `;

    const count = parseInt(result[0].count) + 1;
    return `ORCH-${today}-${count.toString().padStart(4, '0')}`;
  } finally {
    await client`SELECT pg_advisory_unlock(hashtext('session_number_gen'))`;
  }
}
```

---

## Issue #3: Stale Context in Data Extraction Agent

### Problem
The DataExtractionAgent extracts data from conversation summary, but the summary is **stale** - it doesn't include the most recent user message.

**Log Evidence:**
```typescript
// User just said: "No. I do have a concern."
// But extraction agent only sees:
[DataExtractionAgent] Exchanges: [
  {
    "index": 0,
    "customer": "Hey, roof, roof, and roof.",  // ❌ OLD MESSAGE
    "agent": "Hello! It sounds like you might have some roofing concerns..."
  },
  {
    "index": 0,  // ❌ DUPLICATE (from Issue #1)
    "customer": "Hey, roof, roof, and roof.",
    "agent": "Hello! It sounds like you might have some roofing concerns..."
  },
  {
    "index": 1,
    "customer": "I don't have any concerns, actually.",  // ❌ OLD MESSAGE
    "agent": "That's great to hear..."
  }
]
// ❌ MISSING: Latest message "No. I do have a concern."
```

### Root Cause
**File:** `apps/api/src/modules/chat/orchestrator/agents/data-extraction.agent.ts`

The DataExtractionAgent runs **before** the conversation summary is appended, so it only sees previous exchanges, not the current one.

**Execution Order:**
1. User message arrives: `"No. I do have a concern."`
2. WorkerReplyAgent generates response: `"That's great to hear..."` (wrong response, see Issue #4)
3. **DataExtractionAgent executes** ← Uses old summary (doesn't have latest exchange yet)
4. **Then summary is appended** ← Too late for extraction agent

### Impact
- **High Severity**
- Extraction agent works with incomplete/outdated data
- Cannot extract information from current user message
- Leads to incorrect field updates

### Proposed Fix

**Location:** `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`

**Strategy:** Pass the current exchange explicitly to DataExtractionAgent instead of relying on summary.

```typescript
// ✅ FIX: Pass current exchange to extraction agent
async processMessage(sessionId: string, userMessage: string) {
  // 1. Generate response
  const response = await workerAgent.execute(state, userMessage);

  // 2. Extract from CURRENT exchange (not stale summary)
  const currentExchange = {
    customer: userMessage,
    agent: response
  };

  await dataExtractionAgent.extract(state, currentExchange, {
    // Also pass recent summary for context (optional)
    recentExchanges: state.context.summary_of_conversation_on_each_step_until_now.slice(-3)
  });

  // 3. Append to summary AFTER extraction
  state = this.contextManager.appendConversationSummary(state, userMessage, response);
}
```

**DataExtractionAgent Changes:**
```typescript
// ✅ Update extraction method signature
async extract(
  state: AgentContextState,
  currentExchange: { customer: string, agent: string },  // NEW: Current exchange
  options?: {
    recentExchanges?: ConversationSummary[],  // Optional: Historical context
    lookbackCount?: number
  }
): Promise<Partial<DAGContext>> {
  // Build prompt with CURRENT exchange + recent history
  const exchanges = [
    ...(options?.recentExchanges || []),
    currentExchange  // ✅ Always include current exchange
  ];

  // ... extraction logic ...
}
```

---

## Issue #4: Wrong Agent Response (Context Mismatch)

### Problem
Agent generates incorrect/inappropriate responses that don't match the conversation context:

**User:** `"Yeah. Actually, I do have a, a concern."`
**Agent:** `"That's great to hear! If you ever have any questions or need assistance in the future, feel free to reach out."` ❌

The agent is responding as if the customer said they have NO concerns (from previous message), ignoring the current message.

### Root Cause
**File:** `apps/api/src/modules/chat/orchestrator/agents/worker-reply.agent.ts`

The WorkerReplyAgent is constructing its prompt from the conversation summary, which is stale (related to Issue #3).

**Current Flow:**
```typescript
// ❌ PROBLEM: Worker sees stale summary, not current message
const prompt = this.buildPrompt({
  nodeGoal: currentNode.goal,
  conversationSummary: state.context.summary_of_conversation_on_each_step_until_now,  // ❌ Stale!
  currentNodeName: state.currentNode
});

// LLM generates response based on old context
const response = await llm.call(prompt);  // ❌ Wrong response
```

### Impact
- **Critical Severity**
- Confusing/frustrating user experience
- Agent appears "broken" or "not listening"
- Undermines trust in system

### Proposed Fix

**Location:** `apps/api/src/modules/chat/orchestrator/agents/worker-reply.agent.ts`

**Strategy:** Always include the latest user message explicitly in the prompt.

```typescript
// ✅ FIX: Include current user message in prompt
async execute(state: AgentContextState, currentUserMessage: string): Promise<string> {
  const prompt = this.buildPrompt({
    nodeGoal: currentNode.goal,
    // ✅ Include current message explicitly
    currentUserMessage: currentUserMessage,
    // ✅ Include recent history for context
    recentExchanges: state.context.summary_of_conversation_on_each_step_until_now.slice(-3),
    currentNodeName: state.currentNode,
    contextData: state.context.data_extraction_fields
  });

  const response = await this.llmService.call(prompt);
  return response;
}

private buildPrompt(params: {
  nodeGoal: string,
  currentUserMessage: string,  // NEW
  recentExchanges?: ConversationSummary[],
  currentNodeName: string,
  contextData: any
}): string {
  return `
You are a customer service agent at ${params.currentNodeName}.

Goal: ${params.nodeGoal}

Recent conversation:
${params.recentExchanges?.map(ex => `Customer: ${ex.customer}\nAgent: ${ex.agent}`).join('\n\n')}

Current customer message: ${params.currentUserMessage}  // ✅ CRITICAL: Latest message

Current context data: ${JSON.stringify(params.contextData, null, 2)}

Generate an appropriate response based on the CURRENT message and conversation context.
`;
}
```

---

## Issue #5: Empty Extraction Values Overwriting Context

### Problem
The `Extract_Customer_Issue` MCP node extracts empty values which can potentially overwrite existing context:

```typescript
// ❌ Extraction returns empty values
{
  "customers_main_ask": "",
  "customer_name": "",
  "customer_phone_number": ""
}

// These get merged into context, potentially clearing existing data
```

### Root Cause
**File:** `apps/api/src/modules/chat/orchestrator/agents/agent-context.service.ts:193-198`

The `updateContext()` method has a guard against empty strings for top-level fields, but the `data_extraction_fields` are merged directly:

```typescript
} else if (key === 'data_extraction_fields') {
  // ✅ MERGE nested data_extraction_fields object (not replace)
  const existing = state.context.data_extraction_fields || {};
  merged.data_extraction_fields = { ...existing, ...value };
  // ❌ PROBLEM: Empty strings in `value` will overwrite existing non-empty values
}
```

### Impact
- **Medium-High Severity**
- Extracted data can be lost
- Context becomes inconsistent
- Confusing agent behavior (forgets previously extracted info)

### Proposed Fix

**Location:** `apps/api/src/modules/chat/orchestrator/agents/agent-context.service.ts:188-192`

**Strategy:** Only merge non-empty extraction field values.

```typescript
} else if (key === 'data_extraction_fields') {
  // ✅ IMPROVED: Merge only non-empty values
  const existing = state.context.data_extraction_fields || {};
  const updates = value || {};

  // Filter out empty/null/undefined values before merging
  const filteredUpdates = Object.entries(updates).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      acc[k] = v;
    }
    return acc;
  }, {} as any);

  merged.data_extraction_fields = { ...existing, ...filteredUpdates };

  const updatedKeys = Object.keys(filteredUpdates);
  if (updatedKeys.length > 0) {
    console.log(`[AgentContext] 📝 Data extraction fields merged: ${updatedKeys.join(', ')}`);
  } else {
    console.log(`[AgentContext] ℹ️  Data extraction returned no new values (all empty)`);
  }
}
```

---

## Issue #6: Navigator Validation Logic Issues

### Problem
The Navigator marks conversation as "off track" inappropriately:

**Example:**
```json
{
  "validationStatus": {
    "onTrack": false,
    "reason": "The customer stated they have no concerns, which indicates a lack of a specific issue."
  },
  "nextNode": "wait_for_customers_reply",
  "matchedCondition": "if customer only greeted without mentioning any issue"
}
```

**Issues:**
1. Customer DID state an issue ("I don't have concerns" → then changed mind → "I do have a concern")
2. Matched condition doesn't match the actual conversation state
3. Validation reason is outdated (based on old message, not current)

### Root Cause
**File:** `apps/api/src/modules/chat/orchestrator/agents/navigator.agent.ts`

Navigator is also using stale conversation summary (related to Issues #3 and #4).

### Impact
- **Medium Severity**
- Incorrect routing decisions
- Confusing conversation flow
- Unnecessary loopback states

### Proposed Fix

**Location:** `apps/api/src/modules/chat/orchestrator/agents/navigator.agent.ts`

**Strategy:** Same as Issues #3 and #4 - pass current exchange explicitly.

```typescript
// ✅ FIX: Navigator should see current exchange
async decide(
  state: AgentContextState,
  currentExchange: { customer: string, agent: string }  // NEW
): Promise<NavigationDecision> {
  const prompt = this.buildPrompt({
    currentNode: state.currentNode,
    currentExchange: currentExchange,  // ✅ Latest exchange
    recentHistory: state.context.summary_of_conversation_on_each_step_until_now.slice(-3),
    extractedData: state.context.data_extraction_fields,
    availableTransitions: this.getAvailableTransitions(state.currentNode)
  });

  const decision = await this.llmService.call(prompt);
  return decision;
}
```

---

## Issue #7: Internal Node Double Processing

### Problem
Internal nodes like `wait_for_customers_reply` are added to `node_traversed` multiple times:

```json
"node_traversed": [
  "GREET_CUSTOMER",
  "ASK_CUSTOMER_ABOUT_THEIR_NEED",
  "ASK_CUSTOMER_ABOUT_THEIR_NEED",  // ❌ Already duplicate from Issue #1
  "wait_for_customers_reply",
  "wait_for_customers_reply"  // ❌ Added twice
]
```

**Log Evidence:**
```
[AgentOrchestrator] ⏸️  Internal node - skipping agent execution
[AgentContext] 🗺️  Node traversed appended: wait_for_customers_reply, total nodes: 5
```

The orchestrator skips agent execution for internal nodes (correct), but still appends to node_traversed (incorrect duplication).

### Root Cause
**File:** `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`

Internal nodes are appended during navigation transition AND again when the next message arrives (because they're in currentNode).

### Impact
- **Low-Medium Severity**
- Inflated node traversal array
- Confusing path analysis
- Incorrect "total nodes" count

### Proposed Fix

**Location:** `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`

**Strategy:** Only append internal nodes ONCE during transition, not on message arrival.

```typescript
// ✅ FIX: Track if node was already appended
private async transitionToNode(state: AgentContextState, nodeName: string): Promise<AgentContextState> {
  // Update current node
  state = this.contextManager.updateCurrentNode(state, nodeName);

  // If internal node, mark it as "already processed" (don't append again on next message)
  if (this.isInternalNode(nodeName)) {
    state.context.flags = {
      ...state.context.flags,
      [`${nodeName}_processed`]: 1
    };
  }

  return state;
}

// When processing message, check if node already processed
async processMessage(sessionId: string, userMessage: string) {
  const state = this.getState(sessionId);

  // ✅ Skip appending if already processed
  if (this.isInternalNode(state.currentNode) && state.context.flags?.[`${state.currentNode}_processed`]) {
    console.log(`[AgentOrchestrator] ⏭️  Skipping already-processed internal node ${state.currentNode}`);
    // Continue without appending node again
  } else {
    // Normal processing
  }
}
```

---

## Priority & Implementation Order

### Critical (Fix Immediately)
1. **Issue #4:** Wrong Agent Response → User-facing impact
2. **Issue #3:** Stale Context in Extraction → Breaks data collection
3. **Issue #5:** Empty Values Overwriting → Data loss

### High Priority (Fix Soon)
4. **Issue #1:** Duplicate Traversal/Summary → Token waste, confusion
5. **Issue #6:** Navigator Validation → Routing problems

### Medium Priority (Fix When Possible)
6. **Issue #2:** Session Number Race Condition → Rare, self-healing
7. **Issue #7:** Internal Node Duplication → Minor impact

---

## Testing Plan

### Test Scenario 1: Context Freshness
```typescript
// Verify current message is used, not stale summary
1. User: "Hello"
2. Agent: "Hi! How can I help?"
3. User: "I need help with my roof"  // ✅ This MUST be in extraction/navigation context
4. Verify:
   - DataExtractionAgent sees "I need help with my roof"
   - NavigatorAgent sees "I need help with my roof"
   - WorkerReplyAgent generates response based on "I need help with my roof"
```

### Test Scenario 2: No Duplicates
```typescript
// Verify no duplicate nodes/summaries
1. User: "Hello"
2. User: "I need a quote"
3. User: "For roofing work"
4. Verify:
   - node_traversed has no duplicates
   - summary_of_conversation has no duplicates
   - Indices are sequential (0, 1, 2)
```

### Test Scenario 3: Empty Extraction Guard
```typescript
// Verify empty extraction doesn't clear existing data
1. Extract: { customer_name: "John", phone: "555-1234" }
2. Extract: { customer_name: "", phone: "" }  // ❌ Should NOT clear existing
3. Verify:
   - customer_name is still "John"
   - phone is still "555-1234"
```

### Test Scenario 4: Concurrent Session Creation
```typescript
// Verify no session number conflicts
1. Create 10 sessions concurrently
2. Verify:
   - All sessions created successfully
   - No "Session number conflict" retries
   - All session_numbers are unique
```

---

## Rollout Strategy

### Phase 1: Critical Fixes (Week 1)
- Fix Issue #4 (Wrong Response)
- Fix Issue #3 (Stale Extraction)
- Fix Issue #5 (Empty Overwrite)
- Deploy to staging
- Run Test Scenarios 1 & 3
- Deploy to production

### Phase 2: High Priority (Week 2)
- Fix Issue #1 (Duplicates)
- Fix Issue #6 (Navigator)
- Deploy to staging
- Run Test Scenario 2
- Deploy to production

### Phase 3: Cleanup (Week 3)
- Fix Issue #2 (Race Condition)
- Fix Issue #7 (Internal Nodes)
- Deploy to staging
- Run Test Scenario 4
- Deploy to production

---

## Conclusion

These 7 state management issues are causing significant coherence problems in the AI chat system. The root cause is primarily **stale context propagation** - agents are making decisions based on outdated conversation state.

The fixes are straightforward and low-risk:
1. Pass current exchange explicitly to all agents
2. Append summary/nodes only once per turn
3. Guard against empty value overwrites
4. Use atomic session numbering

**Estimated Effort:** 3-5 days (including testing)
**Risk Level:** Low (fixes are isolated to context management layer)
**User Impact:** High (much better conversation coherence and accuracy)
