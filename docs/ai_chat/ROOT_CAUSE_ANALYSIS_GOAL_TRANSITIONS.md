# Root Cause Analysis: Agent Not Gathering Customer Data

## Executive Summary

**Issue:** The AI agent successfully identified the customer's service request ("Roof hole repair") but never collected customer contact information (name, phone, email).

**Root Cause:** Goal transitions are not evaluated in streaming mode (`processMessageStream`), causing the agent to remain stuck in the `UNDERSTAND_REQUEST` goal indefinitely.

**Impact:** Critical - Customer data collection is completely broken in streaming mode (production mode).

---

## Problem Analysis

### What Should Have Happened

According to the agent configuration (`agent_config.json`):

1. **UNDERSTAND_REQUEST** goal (lines 7-35):
   - mandatory_fields: `["service.primary_request"]`
   - quality_checks: `["issue_is_clear"]`
   - auto_advance_conditions:
     - Deterministic: `service.primary_request is_set` → GATHER_REQUIREMENTS
     - Semantic: "customer has clearly stated their issue" → GATHER_REQUIREMENTS

2. Once `service.primary_request` is extracted, the agent should:
   - ✅ Check success criteria (mandatory field met)
   - ✅ Evaluate advance conditions (deterministic condition matches)
   - ✅ Transition to **GATHER_REQUIREMENTS** goal

3. **GATHER_REQUIREMENTS** goal (lines 38-85):
   - mandatory_fields: `["customer.phone"]`
   - conditional_fields: `{ "if_new_customer": ["customer.name"] }`
   - Agent asks for customer contact information

### What Actually Happened (from logs)

```
🌊 [WorkerReplyAgent] Streaming goal: UNDERSTAND_REQUEST
[DataExtractionAgent] ✅ Successfully extracted 1 fields
[DataExtractionAgent] 🎉 Extraction complete - 1 fields updated: service.primary_request
```

**Evidence:**
- ✅ service.primary_request extracted as "Roof hole repair"
- ❌ Goal remained UNDERSTAND_REQUEST throughout entire conversation
- ❌ Never advanced to GATHER_REQUIREMENTS
- ❌ Never asked for customer.phone, customer.name, customer.email
- ❌ NO GoalTransitionEngine logs in output

---

## Root Cause: Missing Goal Transition in Streaming Mode

### Code Analysis

#### File: `agent-orchestrator.service.ts`

**Two Execution Paths:**

1. **Non-Streaming Path** (`executeConversationLoop` - line 360):
   ```typescript
   // STEP 2: GoalTransitionEngine evaluates if we should transition to next goal
   const transitionResult = await this.transitionEngine.evaluateTransition(
     contextV3.conversation.current_goal,
     contextV3,
     conversationHistory
   );

   if (transitionResult.shouldTransition && transitionResult.nextGoal) {
     // Advance to next goal
     const nextNodeOrGoal = transitionResult.nextGoal;
     state = this.contextManager.updateCurrentNode(state, nextNodeOrGoal);
   }
   ```
   ✅ **CALLS GoalTransitionEngine** - transitions work correctly

2. **Streaming Path** (`processMessageStream` - line 227):
   ```typescript
   // Stream response from worker agent
   for await (const chunk of this.workerReplyAgent.executeGoalStream(...)) {
     if (chunk.done) {
       // Update conversation summary
       state = this.contextManager.appendConversationSummary(state, args.message, fullResponse);

       // Run data extraction (non-streaming)
       const extractionResult = await this.dataExtractionAgent.extractAndUpdateContext(state, currentExchange);

       // Save state
       await this.saveState(state);

       // ❌ MISSING: No call to transitionEngine.evaluateTransition()
       // ❌ Goal NEVER changes - stays in UNDERSTAND_REQUEST forever
     }
   }
   ```
   ❌ **NEVER CALLS GoalTransitionEngine** - agent stuck in first goal

### Why This Breaks the Flow

| Step | Expected Behavior | Actual Behavior (Streaming) |
|------|-------------------|----------------------------|
| 1. Customer says "roof holes" | Extract service request | ✅ Works |
| 2. service.primary_request = "Roof hole repair" | Success criteria met | ✅ Works |
| 3. Check auto_advance_conditions | Deterministic condition matches | ❌ **SKIPPED** |
| 4. Transition to GATHER_REQUIREMENTS | Goal changes, new mandatory fields | ❌ **NEVER HAPPENS** |
| 5. Ask for customer.phone | Agent asks for contact info | ❌ **NEVER ASKS** |

---

## Impact Assessment

### Critical Issues

1. **Data Collection Broken in Production**
   - Streaming mode is used in production (real-time chat)
   - Customer data never collected
   - No way to create tasks, book appointments, or contact customers

2. **Goals Never Advance**
   - Agent stuck in UNDERSTAND_REQUEST forever
   - Never reaches GATHER_REQUIREMENTS, DESIGN_SOLUTION, EXECUTE_SOLUTION
   - Complete workflow paralysis

3. **Silent Failure**
   - No errors thrown
   - Agent appears to work (responds to messages)
   - Data extraction works
   - But workflow progression completely broken

### Why Data Extraction Alone Isn't Enough

The data extraction agent is **passive** (`data-extraction-agent.service.ts:108-112`):

```typescript
// ⚠️ IMPORTANT: Data extraction is PASSIVE, NOT active
// - This agent ONLY extracts information customer ALREADY SAID
// - It does NOT drive what questions to ask
// - Goal's success_criteria.mandatory_fields determine what conversational agent asks for
// - Extraction runs in parallel to capture any volunteered information
```

**Design Intent:**
- Data extraction: Extract what customer volunteers
- WorkerReplyAgent: Ask for mandatory fields based on current goal
- GoalTransitionEngine: Advance goals when criteria met

**Current State:**
- ✅ Data extraction works (passive)
- ✅ WorkerReplyAgent works (asks for UNDERSTAND_REQUEST fields only)
- ❌ **GoalTransitionEngine never called (goals never advance)**

---

## Solution

### Required Fix

Add goal transition evaluation to `processMessageStream` method:

**File:** `apps/api/src/modules/chat/orchestrator/agents/agent-orchestrator.service.ts`
**Line:** ~310 (after data extraction, before saving state)

```typescript
// Run data extraction (non-streaming)
const currentExchange = { customer: args.message, agent: fullResponse };
const extractionResult = await this.dataExtractionAgent.extractAndUpdateContext(
  state,
  currentExchange
);

if (extractionResult.fieldsUpdated && extractionResult.fieldsUpdated.length > 0) {
  state = this.contextManager.updateContext(state, extractionResult.contextUpdates || {});
}

// ✅ ADD THIS: Evaluate goal transition (same logic as executeConversationLoop)
const conversationHistory = (state.context.summary_of_conversation_on_each_step_until_now || []).map(
  (entry: any) => ({ customer: entry.customer, agent: entry.agent })
);

const { migrateContextV2toV3 } = await import('../migrations/context-migration-v2-to-v3.js');
const contextV3 = migrateContextV2toV3(state.context, state.sessionId, args.chatSessionId, args.userId);

const transitionResult = await this.transitionEngine.evaluateTransition(
  contextV3.conversation.current_goal,
  contextV3,
  conversationHistory
);

console.log(`[AgentOrchestrator] 🧭 Transition: ${transitionResult.shouldTransition ? 'YES' : 'NO'}`);
console.log(`[AgentOrchestrator]    Current: ${contextV3.conversation.current_goal}`);
if (transitionResult.shouldTransition && transitionResult.nextGoal) {
  console.log(`[AgentOrchestrator]    Next: ${transitionResult.nextGoal}`);
  console.log(`[AgentOrchestrator]    Reason: ${transitionResult.reason}`);
  state = this.contextManager.updateCurrentNode(state, transitionResult.nextGoal);
}

// Save state (now includes potentially updated goal)
await this.saveState(state);
```

### Verification Tests

After fix, verify:

1. **Goal Transitions Work:**
   ```
   Customer: "roof holes"
   → service.primary_request = "Roof hole repair"
   → UNDERSTAND_REQUEST criteria met
   → Transition to GATHER_REQUIREMENTS ✅
   → Agent asks for customer phone ✅
   ```

2. **Data Collection Works:**
   ```
   Customer: "555-1234"
   → customer.phone = "555-1234"
   → GATHER_REQUIREMENTS criteria met
   → Transition to DESIGN_SOLUTION ✅
   ```

3. **Logs Show Transitions:**
   ```
   🎯 [GoalTransitionEngine] Evaluating goal: UNDERSTAND_REQUEST
   [GoalTransitionEngine] ✅ Success criteria met: service.primary_request
   [GoalTransitionEngine] ✅ DETERMINISTIC MATCH: Transition to GATHER_REQUIREMENTS
   🌊 [WorkerReplyAgent] Streaming goal: GATHER_REQUIREMENTS
   ```

---

## Detailed Logs Analysis

### Evidence from Conversation Logs

```
[AgentOrchestrator] 📂 Resuming streaming session 8a927aa3...
🌊 [WorkerReplyAgent] Streaming goal: UNDERSTAND_REQUEST  <-- NEVER CHANGES
[WorkerReplyAgent] Goal: Understand what the customer needs help with

🔍 [DataExtractionAgent] Analyzing conversation for context updates...
[DataExtractionAgent] ✅ Successfully extracted 1 fields
[DataExtractionAgent] 🎉 Extraction complete - 1 fields updated: service.primary_request
```

**Missing:**
- No `🎯 [GoalTransitionEngine]` logs
- No transition evaluation
- No goal changes
- Goal stays UNDERSTAND_REQUEST for entire conversation

---

## Timeline of Issue

| Message # | Customer Input | Agent Response | Goal | Data Extracted | Should Transition? |
|-----------|----------------|----------------|------|----------------|-------------------|
| 1 | "Hello" | "How can I assist?" | UNDERSTAND_REQUEST | (none) | NO - need service request |
| 2 | "actually roof" | "What help do you need?" | UNDERSTAND_REQUEST | service.primary_request | **YES → should go to GATHER_REQUIREMENTS** ❌ |
| 3 | "roof holes" | "Are you looking for repairs?" | UNDERSTAND_REQUEST ❌ | service.primary_request (updated) | **YES** ❌ |
| 4 | "repair" | "Looking for repair assistance?" | UNDERSTAND_REQUEST ❌ | service.primary_request (updated) | **YES** ❌ |
| 5 | "schedule" | "Ready to schedule?" | UNDERSTAND_REQUEST ❌ | (none) | **YES** ❌ |

**Expected after Message #2:**
- Goal: GATHER_REQUIREMENTS
- Agent: "Great! To help you with the roof hole repair, may I have your phone number?"

---

## Configuration References

### UNDERSTAND_REQUEST Goal
**File:** `agent_config.json` lines 7-35

```json
{
  "goal_id": "UNDERSTAND_REQUEST",
  "success_criteria": {
    "mandatory_fields": ["service.primary_request"],  // ✅ MET
    "quality_checks": ["issue_is_clear"]              // ✅ MET
  },
  "auto_advance_conditions": [
    {
      "type": "semi_deterministic",
      "json_path": "service.primary_request",
      "operator": "is_set",                            // ✅ TRUE
      "next_goal": "GATHER_REQUIREMENTS"               // ❌ NEVER EXECUTED
    }
  ]
}
```

### GATHER_REQUIREMENTS Goal
**File:** `agent_config.json` lines 38-85

```json
{
  "goal_id": "GATHER_REQUIREMENTS",
  "success_criteria": {
    "mandatory_fields": ["customer.phone"],           // ⚠️ NEVER REACHED
    "conditional_fields": {
      "if_new_customer": ["customer.name"]            // ⚠️ NEVER REACHED
    }
  }
}
```

---

## Recommendations

### Immediate Action (P0 - Critical)

1. ✅ **Apply the fix** to `processMessageStream` method
2. ✅ **Test goal transitions** in streaming mode
3. ✅ **Verify data collection** works end-to-end

### Follow-up Actions (P1 - High)

1. **Add integration tests** for goal transitions in streaming mode
2. **Add monitoring** to detect when goals never advance
3. **Review non-streaming path** - ensure parity between paths

### Architectural Improvements (P2 - Medium)

1. **Unified execution path** - eliminate code duplication between streaming/non-streaming
2. **Transition engine middleware** - ensure transitions always evaluated regardless of mode
3. **Goal state visualization** - dashboard showing current goal distribution

---

## Appendix: Key Files

| File | Purpose | Lines of Interest |
|------|---------|------------------|
| `agent-orchestrator.service.ts` | Main orchestrator | 227-355 (streaming), 360-850 (non-streaming) |
| `goal-transition.engine.ts` | Evaluates goal transitions | 41-99 (evaluateTransition) |
| `data-extraction-agent.service.ts` | Passive data extraction | 38-235 (extractAndUpdateContext) |
| `worker-reply-agent.service.ts` | Generates responses | 104-163 (executeGoalStream), 209-279 (buildReActPrompt) |
| `agent_config.json` | Goal definitions | 7-35 (UNDERSTAND_REQUEST), 38-85 (GATHER_REQUIREMENTS) |

---

## Conclusion

The agent is **working as designed** within its current goal (UNDERSTAND_REQUEST) but **cannot progress** because goal transitions are never evaluated in streaming mode.

The fix is simple but critical: Add transition evaluation to the streaming path, matching the logic in the non-streaming path.

**Severity:** Critical - Production feature completely broken
**Complexity:** Low - 20 lines of code
**Risk:** Low - Reuses existing, tested transition logic
**Priority:** P0 - Immediate fix required
