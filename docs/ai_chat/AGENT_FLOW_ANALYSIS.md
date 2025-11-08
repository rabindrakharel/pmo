# Agent Flow Analysis - MCP Nodes & Auto-Advance

> **Status:** ✅ FIXED in commit `fdd34ff`
>
> **Branch:** `claude/fix-context-data-api-011CUuhgpTfBzse9X6tDieKZ`

---

## 🔍 Executive Summary

**Critical Issue Found (FIXED):**
- ❌ **3 MCP nodes with `stepwise` advance_type** - Caused unnecessary waiting for user input after automated operations
- ✅ **Fixed:** Changed all MCP nodes to `advance_type='auto'`

**Impact of Fix:**
- Eliminates dead states where conversation stalls after MCP operations
- Enables smooth auto-advance flow through automated backend operations
- Improves UX - no more confused customers waiting after MCP executes

---

## 🔴 Critical Issue: MCP Nodes Waiting for User Input

### Problem:
MCP (Model Context Protocol) nodes perform automated backend operations (API calls, database lookups, etc.) and **should NOT wait for user input** after completing. However, several MCP nodes were configured with `advance_type='stepwise'`, which **forced the system to wait for user response** after automated operations completed.

### Affected Nodes (BEFORE FIX):

| Node Name | Action | Advance Type | Issue | Fixed To |
|-----------|--------|--------------|-------|----------|
| `Check_IF_existing_customer` | `mcp` | ❌ **stepwise** | Waits after customer lookup | ✅ `auto` |
| `Plan` | `mcp` | ❌ **stepwise** | Waits after planning | ✅ `auto` |
| `Execute_Plan_Using_MCP` | `mcp` | ❌ **stepwise** | Waits after MCP execution | ✅ `auto` |

### Expected Behavior (BEFORE FIX):
```
User: "My roof is leaking"
→ Extract_Customer_Issue (MCP, auto) ✅ auto-advances
→ Acknowledge_And_Empathize (reply, auto) ✅ auto-advances
→ Try_To_Gather_Customers_Data (reply, stepwise) ✅ waits for user (CORRECT)
→ [User provides phone/name]
→ Check_IF_existing_customer (MCP, STEPWISE) ❌ WAITS FOR USER (WRONG!)
```

### What Should Happen (AFTER FIX):
```
→ Check_IF_existing_customer (MCP, AUTO) ✅ auto-advances
→ Plan (MCP, AUTO) ✅ auto-advances
→ Communicate_To_Customer_Before_Action (reply, stepwise) ✅ waits for user confirmation
```

---

## 🟡 Inconsistent MCP Node Configuration (BEFORE FIX)

### Current Pattern:

**Correctly Configured (auto):**
- ✅ `Extract_Customer_Issue` (mcp, auto) → Does NOT wait

**Incorrectly Configured (stepwise):**
- ❌ `Check_IF_existing_customer` (mcp, stepwise) → WAITS (shouldn't)
- ❌ `Plan` (mcp, stepwise) → WAITS (shouldn't)
- ❌ `Execute_Plan_Using_MCP` (mcp, stepwise) → WAITS (shouldn't)

### Rule of Thumb:
```
MCP nodes (backend operations):
  → advance_type = 'auto' (don't wait)

Reply nodes (customer-facing messages):
  → advance_type = 'stepwise' (wait for response)
  → UNLESS followed by another auto operation
```

---

## 🔧 Changes Applied (Commit fdd34ff)

### Fix #1: Check_IF_existing_customer
Changed **all 3 branching conditions** from `stepwise` → `auto`:

```json
{
  "node_name": "Check_IF_existing_customer",
  "node_action": "mcp",
  "branching_conditions": [
    {
      "condition": "if customer exists",
      "child_node": "Plan",
      "advance_type": "auto"  // ✅ CHANGED from stepwise
    },
    {
      "condition": "if customer does not exist",
      "child_node": "Plan",
      "advance_type": "auto"  // ✅ CHANGED from stepwise
    },
    {
      "condition": "if customer changes issue in response",
      "child_node": "Extract_Customer_Issue",
      "advance_type": "auto"  // ✅ CHANGED from stepwise
    }
  ]
}
```

### Fix #2: Plan
Changed **all 3 branching conditions** from `stepwise` → `auto`:

```json
{
  "node_name": "Plan",
  "node_action": "mcp",
  "branching_conditions": [
    {
      "condition": "if plan requires additional MCP fetch",
      "child_node": "use_mcp_to_get_info",
      "advance_type": "auto"  // ✅ CHANGED from stepwise
    },
    {
      "condition": "if plan already exists (plan_flag: 1)",
      "child_node": "Communicate_To_Customer_Before_Action",
      "advance_type": "auto"  // ✅ CHANGED from stepwise
    },
    {
      "condition": "if customer changes issue",
      "child_node": "Extract_Customer_Issue",
      "advance_type": "auto"  // ✅ CHANGED from stepwise
    }
  ]
}
```

### Fix #3: Execute_Plan_Using_MCP
Changed **all 3 branching conditions** from `stepwise` → `auto`:

```json
{
  "node_name": "Execute_Plan_Using_MCP",
  "node_action": "mcp",
  "branching_conditions": [
    {
      "condition": "if execution requires additional info",
      "child_node": "use_mcp_to_get_info",
      "advance_type": "auto"  // ✅ CHANGED from stepwise
    },
    {
      "condition": "if execution fails",
      "child_node": "Plan",
      "advance_type": "auto"  // ✅ CHANGED from stepwise
    },
    {
      "condition": "if customer changes issue",
      "child_node": "Extract_Customer_Issue",
      "advance_type": "auto"  // ✅ CHANGED from stepwise
    }
  ]
}
```

---

## 🎯 Expected Flow After Fix

### Before Fix (Broken):
```
User: "My roof is leaking, I'm John, 555-1234"
  ↓
Agent: "I understand. Let me help you." (Acknowledge_And_Empathize)
  ↓ AUTO
Agent: "Can I get your name and phone?" (Try_To_Gather_Customers_Data)
  ↓ STEPWISE (waits)
User: "John, 555-1234"
  ↓
[MCP: Check customer] ⏸️ WAITS FOR USER ❌ (unnecessary!)
  ↓
User: <nothing to say, confused>
```

### After Fix (Smooth):
```
User: "My roof is leaking, I'm John, 555-1234"
  ↓
Agent: "I understand. Let me help you." (Acknowledge_And_Empathize)
  ↓ AUTO
Agent: "Can I get your name and phone?" (Try_To_Gather_Customers_Data)
  ↓ STEPWISE (waits)
User: "John, 555-1234"
  ↓ AUTO
[MCP: Check customer] ✅ Executes automatically
  ↓ AUTO
[MCP: Plan] ✅ Executes automatically
  ↓ AUTO
Agent: "I'll create a task for roof repair. Shall I proceed?" (Communicate)
  ↓ STEPWISE (waits)
User: "Yes, please"
  ↓ AUTO
[MCP: Execute] ✅ Executes automatically
  ↓ AUTO
Agent: "Done! Task created for tomorrow at 10am." (Tell_Customers_Execution)
```

---

## 📊 Summary of Changes

| Node Name | Branching Conditions Changed | Total Changes |
|-----------|----------------------------|---------------|
| `Check_IF_existing_customer` | 3/3 | 3 |
| `Plan` | 3/3 | 3 |
| `Execute_Plan_Using_MCP` | 3/3 | 3 |
| **TOTAL** | **9/9** | **9** |

---

## 🎓 Design Pattern (Best Practices)

### MCP Node Pattern:
```json
{
  "node_name": "Any_MCP_Operation",
  "node_action": "mcp",
  "branching_conditions": [
    {
      "condition": "...",
      "child_node": "Next_Node",
      "advance_type": "auto"  // ✅ ALWAYS auto for MCP
    }
  ]
}
```

### Reply Node Pattern (Waiting for User):
```json
{
  "node_name": "Ask_User_Something",
  "node_action": "reply",
  "branching_conditions": [
    {
      "condition": "...",
      "child_node": "Next_Node",
      "advance_type": "stepwise"  // ✅ Wait for user response
    }
  ]
}
```

### Reply Node Pattern (Automated Chain):
```json
{
  "node_name": "Inform_User_Something",
  "node_action": "reply",
  "branching_conditions": [
    {
      "condition": "...",
      "child_node": "Next_Automated_Step",
      "advance_type": "auto"  // ✅ Don't wait, continue flow
    }
  ]
}
```

---

## ⚠️ Remaining Issue: GREET_CUSTOMER

**Status:** Not fixed yet (optional improvement)

**Current:**
```json
{
  "node_name": "GREET_CUSTOMER",
  "branching_conditions": [
    {
      "condition": "if customer stated their issue in first message",
      "child_node": "Extract_Customer_Issue",
      "advance_type": "stepwise"  // ⚠️ Could be auto for smoother flow
    }
  ]
}
```

**Recommendation:** Change to `"auto"` for smoother flow when customer provides all info upfront.

---

## ✅ Verification Checklist

After applying fixes, verify:

- [x] All MCP nodes have `advance_type: 'auto'` ✅
- [x] Reply nodes have `advance_type: 'stepwise'` when expecting user response ✅
- [x] No MCP→Reply transitions cause unnecessary waiting ✅
- [ ] Test conversation flow from greeting to completion without stalls (pending testing)
- [ ] Monitor logs for `[AUTO-ADVANCE ENABLED]` messages after MCP nodes (pending testing)

---

## 📝 Commit Information

**Commit:** `fdd34ff`
**Branch:** `claude/fix-context-data-api-011CUuhgpTfBzse9X6tDieKZ`
**Date:** 2025-11-08
**Message:** `fix(agent-config): Change MCP nodes to auto-advance instead of stepwise`

**Files Changed:**
- `apps/api/src/modules/chat/orchestrator/agent_config.json` (9 lines changed)

---

**Last Updated:** 2025-11-08
