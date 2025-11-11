# AI Chat Service Catalog Fix - 2025-11-09

## Problem Statement

The AI chat system was incorrectly setting service catalog values from conversation extraction instead of MCP tool results, causing coherence issues in the state machine flow.

### Issues Fixed:

1. **Service Catalog Source** - Service catalog was being extracted from conversation instead of fetched via MCP
2. **Missing Service Catalog Identification Node** - No dedicated node for matching customer issue to service catalog via MCP
3. **Infinite Loop in Try_To_Gather_Customers_Data** - Loop detection triggered 7+ times due to missing exit conditions
4. **Unclear Task Creation Flow** - Task creation and appointment booking were not properly sequenced

## Changes Made

### 1. Data Extraction Agent (`data-extraction-agent.service.ts`)

**File:** `apps/api/src/modules/chat/orchestrator/agents/data-extraction-agent.service.ts`

**Change:** Removed `matching_service_catalog_to_solve_customers_issue` from extractable fields

```typescript
// BEFORE (Line 97-104):
const allContextFields = [
  'customer_name',
  'customer_phone_number',
  'customer_email',
  'customers_main_ask',
  'matching_service_catalog_to_solve_customers_issue',  // ❌ WRONG - Should come from MCP
  'related_entities_for_customers_ask'
];

// AFTER:
const allContextFields = [
  'customer_name',
  'customer_phone_number',
  'customer_email',
  'customers_main_ask'
  // NOTE: matching_service_catalog_to_solve_customers_issue should come from MCP (not extracted from conversation)
  // NOTE: related_entities_for_customers_ask should come from MCP (not extracted from conversation)
];
```

**Rationale:** Service catalog must come from MCP `setting_list` tool (dl__service_category), not from customer conversation.

---

### 2. Agent Configuration (`agent_config.json`)

**File:** `apps/api/src/modules/chat/orchestrator/agent_config.json`

#### 2.1. Added New Node: `Identify_Service_Catalog_Via_MCP`

**Location:** After `Acknowledge_And_Empathize` node (line 239)

**Purpose:** Fetch service catalog from MCP settings and match to customer's issue

**Key Properties:**
- `node_action`: `"mcp"` (calls MCP tools)
- `agent_profile_type`: `"worker_mcp_agent"`
- Uses MCP `setting_list` tool to fetch `dl__service_category`
- Matches customer's issue to appropriate service category
- Updates `matching_service_catalog_to_solve_customers_issue` in context

**Example:**
```
Customer issue: "Roof with holes" → MCP fetch → Match to "Roofing" service category
Customer issue: "Brown lawn" → MCP fetch → Match to "Landscaping" service category
```

---

#### 2.2. Updated `Acknowledge_And_Empathize` Node Flow

**Change:** Updated `default_next_node` to route to new service catalog node

```json
// BEFORE:
"default_next_node": "Try_To_Gather_Customers_Data"

// AFTER:
"default_next_node": "Identify_Service_Catalog_Via_MCP"
```

**New Flow:**
```
Extract_Customer_Issue
  → Acknowledge_And_Empathize
  → Identify_Service_Catalog_Via_MCP  ✅ NEW NODE
  → Try_To_Gather_Customers_Data
  → Check_IF_existing_customer
  → Plan (create task via MCP)
  → Ask_Customer_For_Appointment
  → Book_Appointment_Via_MCP
  → Tell_Customers_Execution
```

---

#### 2.3. Fixed `Try_To_Gather_Customers_Data` Loop Detection

**Location:** Line 280-316

**Problem:** Node kept looping indefinitely when phone number wasn't provided

**Solution:** Added exit conditions after 3 attempts and customer refusal

**New Branching Conditions:**
```json
[
  {
    "condition": "if customer_phone_number is populated",
    "child_node": "Check_IF_existing_customer",
    "advance_type": "auto"
  },
  {
    "condition": "if required customer data (phone) is missing after 3 attempts",
    "child_node": "Check_IF_existing_customer",
    "advance_type": "stepwise",
    "loop_back_intention": "Customer hasn't provided phone after multiple attempts. Proceed with available information or offer to skip phone collection."
  },
  {
    "condition": "if customer explicitly refuses to provide phone number",
    "child_node": "Check_IF_existing_customer",
    "advance_type": "stepwise",
    "loop_back_intention": "Customer declined to provide phone. Proceed with available information."
  },
  {
    "condition": "if required customer data (phone) is missing and attempts < 3",
    "child_node": "Try_To_Gather_Customers_Data",
    "advance_type": "stepwise",
    "loop_back_intention": "Still missing phone number. Ask again with different phrasing. Be polite and patient."
  }
]
```

**Impact:** Prevents infinite loops while maintaining data collection goals

---

#### 2.4. Updated `Plan` Node for Task Creation

**Location:** Line 346-374

**Changes:**
1. Updated `node_goal` to be explicit about MCP task creation
2. Changed `default_next_node` to ask for appointment
3. Updated branching conditions

**Before:**
```json
"node_goal": "Create a detailed plan in the JSON for helping the customer...",
"default_next_node": "Communicate_To_Customer_Before_Action"
```

**After:**
```json
"node_goal": "CRITICAL: Use MCP to create task for customer's issue. Then ask customer if they want to book an appointment. If yes, use MCP to book calendar for available employee. This node MUST call MCP task_create tool with customer_id, customers_main_ask, and matching_service_catalog_to_solve_customers_issue.",
"context_update": "MUST call MCP task_create tool to create task and populate task_id. Then ask customer if they want appointment. If yes, call MCP person_calendar_book to schedule and populate appointment_details. Set plan_flag: 1 only after task creation succeeds.",
"default_next_node": "Ask_Customer_For_Appointment"
```

---

#### 2.5. Added New Node: `Ask_Customer_For_Appointment`

**Location:** After `Plan` node (line 376-407)

**Purpose:** Ask customer if they want to book an appointment after task creation

**Key Properties:**
- `node_action`: `"reply"` (customer-facing response)
- `agent_profile_type`: `"worker_reply_agent"`
- Routes to `Book_Appointment_Via_MCP` if customer agrees
- Routes to `Tell_Customers_Execution` if customer declines

**Example Response:**
```
"I've created a task for your roof repair. Would you like me to schedule an appointment with one of our technicians?"
```

---

#### 2.6. Added New Node: `Book_Appointment_Via_MCP`

**Location:** After `Ask_Customer_For_Appointment` (line 408-437)

**Purpose:** Use MCP to book appointment with available employee

**Key Properties:**
- `node_action`: `"mcp"` (calls MCP tools)
- `agent_profile_type`: `"worker_mcp_agent"`
- Calls MCP `person_calendar_book` tool
- Updates `appointment_details`, `assigned_employee_id`, `assigned_employee_name`
- Handles case where no employees are available

**MCP Flow:**
```
1. Call MCP person_calendar_book with task_id
2. Find available technician
3. Book calendar slot
4. Update appointment_details: "Scheduled for 2025-11-10 at 10:00 AM with Bob Smith"
```

---

## Complete Updated Flow

### Before (Problematic Flow):
```
Extract_Customer_Issue
  → Acknowledge_And_Empathize
  → Try_To_Gather_Customers_Data (LOOPS 7+ times) ❌
  → Check_IF_existing_customer
  → Plan
  → Communicate_To_Customer_Before_Action
  → Execute_Plan_Using_MCP
  → Tell_Customers_Execution
```

**Problems:**
- Service catalog extracted from conversation (wrong source) ❌
- No dedicated service catalog identification step ❌
- Try_To_Gather_Customers_Data loops infinitely ❌
- Task creation and appointment booking unclear ❌

---

### After (Fixed Flow):
```
Extract_Customer_Issue
  → Acknowledge_And_Empathize
  → Identify_Service_Catalog_Via_MCP ✅ NEW - Fetches from MCP settings
  → Try_To_Gather_Customers_Data (exits after 3 attempts) ✅
  → Check_IF_existing_customer
  → Plan (creates task via MCP) ✅
  → Ask_Customer_For_Appointment ✅ NEW - Asks customer preference
  → Book_Appointment_Via_MCP ✅ NEW - Books via MCP if customer agrees
  → Tell_Customers_Execution
  → Goodbye_And_Hangup
  → Execute_Call_Hangup
```

**Improvements:**
- Service catalog comes from MCP `setting_list` (dl__service_category) ✅
- Dedicated service catalog identification node ✅
- Try_To_Gather_Customers_Data has proper exit conditions ✅
- Clear task creation and appointment booking sequence ✅
- Customer choice for appointment booking ✅

---

## Expected Behavior After Fix

### 1. Service Catalog Matching
**Before:**
```json
{
  "customers_main_ask": "Roof with holes",
  "matching_service_catalog_to_solve_customers_issue": "Roof repair"  // ❌ Extracted from conversation
}
```

**After:**
```json
{
  "customers_main_ask": "Roof with holes",
  "matching_service_catalog_to_solve_customers_issue": "Roofing"  // ✅ Fetched from MCP dl__service_category
}
```

---

### 2. Loop Prevention

**Before:**
```
node_traversed: [
  "Acknowledge_And_Empathize",
  "Try_To_Gather_Customers_Data",  // 1
  "Try_To_Gather_Customers_Data",  // 2
  "Try_To_Gather_Customers_Data",  // 3
  "Try_To_Gather_Customers_Data",  // 4
  "Try_To_Gather_Customers_Data",  // 5
  "Try_To_Gather_Customers_Data",  // 6
  "Try_To_Gather_Customers_Data",  // 7 ❌ Loop detected!
  "Try_To_Gather_Customers_Data"   // 8
]
```

**After:**
```
node_traversed: [
  "Acknowledge_And_Empathize",
  "Identify_Service_Catalog_Via_MCP",  // ✅ NEW node
  "Try_To_Gather_Customers_Data",      // Attempt 1
  "Try_To_Gather_Customers_Data",      // Attempt 2
  "Try_To_Gather_Customers_Data",      // Attempt 3
  "Check_IF_existing_customer"         // ✅ Exits after 3 attempts
]
```

---

### 3. Complete Conversation Example

**Scenario:** Customer calls about roof problem

```
1. Customer: "My roof has holes"
   → Node: Extract_Customer_Issue
   → Context: customers_main_ask = "Roof with holes"

2. Agent: "I understand you're dealing with roof holes - that must be concerning."
   → Node: Acknowledge_And_Empathize

3. [Behind the scenes]
   → Node: Identify_Service_Catalog_Via_MCP
   → MCP Call: setting_list(dl__service_category)
   → Context: matching_service_catalog_to_solve_customers_issue = "Roofing" ✅

4. Agent: "May I have your phone number?"
   → Node: Try_To_Gather_Customers_Data

5. Customer: "6476467996"
   → Context: customer_phone_number = "6476467996"

6. [Behind the scenes]
   → Node: Check_IF_existing_customer
   → MCP Call: customer_get or customer_create
   → Context: customer_id = "uuid-123"

7. [Behind the scenes]
   → Node: Plan
   → MCP Call: task_create(customer_id, customers_main_ask, service_catalog)
   → Context: task_id = "task-456"

8. Agent: "I've created a task for your roof repair. Would you like me to schedule an appointment?"
   → Node: Ask_Customer_For_Appointment

9. Customer: "Yes, please"
   → Node: Book_Appointment_Via_MCP
   → MCP Call: person_calendar_book(task_id)
   → Context: appointment_details = "Scheduled for 2025-11-10 at 10:00 AM with Bob Smith"

10. Agent: "Your appointment is scheduled for November 10th at 10 AM with Bob Smith."
    → Node: Tell_Customers_Execution

11. Agent: "Thank you for calling. Goodbye!"
    → Node: Goodbye_And_Hangup
```

---

## Testing Checklist

- [ ] Verify service catalog comes from MCP `setting_list` (not conversation)
- [ ] Verify `Identify_Service_Catalog_Via_MCP` node executes after issue extraction
- [ ] Verify loop detection doesn't trigger in `Try_To_Gather_Customers_Data`
- [ ] Verify task creation via MCP in `Plan` node
- [ ] Verify customer is asked for appointment preference
- [ ] Verify appointment booking via MCP when customer agrees
- [ ] Verify proper flow when customer declines appointment
- [ ] Verify context fields populated correctly at each step

---

## Files Modified

1. `apps/api/src/modules/chat/orchestrator/agents/data-extraction-agent.service.ts`
   - Removed service catalog from extractable fields (lines 97-104)

2. `apps/api/src/modules/chat/orchestrator/agent_config.json`
   - Updated `Acknowledge_And_Empathize` node routing (line 230)
   - Added `Identify_Service_Catalog_Via_MCP` node (lines 239-266)
   - Fixed `Try_To_Gather_Customers_Data` loop conditions (lines 280-316)
   - Updated `Plan` node for task creation (lines 353-374)
   - Added `Ask_Customer_For_Appointment` node (lines 376-407)
   - Added `Book_Appointment_Via_MCP` node (lines 408-437)

---

## Deployment Notes

1. Restart API service to load updated configuration
2. Monitor first 10 conversations for proper flow execution
3. Verify MCP tool calls in logs:
   - `setting_list` call in `Identify_Service_Catalog_Via_MCP`
   - `task_create` call in `Plan`
   - `person_calendar_book` call in `Book_Appointment_Via_MCP`
4. Check that service catalog values match settings table, not conversation text

---

## Author
- **Date:** 2025-11-09
- **Issue:** Service catalog incorrectly sourced from conversation instead of MCP
- **Fix:** Added dedicated MCP node for service catalog identification and improved flow branching

---

## Related Documentation
- See `docs/ai_chat/AI_CHAT_SYSTEM.md` for complete AI chat system documentation
- See `apps/api/src/modules/chat/orchestrator/agent_config.json` for full state machine configuration
- See MCP adapter service for available MCP tools
