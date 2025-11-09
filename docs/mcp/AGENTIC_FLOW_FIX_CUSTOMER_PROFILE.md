# Agentic Flow Fix: Customer Profile Management

> **Date:** 2025-11-09
> **Issue:** Agent collected customer data but didn't create customer profile or search for employees
> **Solution:** Added MANAGE_CUSTOMER_PROFILE goal + updated DESIGN_SOLUTION to search employees

---

## 🔍 Problem Analysis

**From Production Logs:**
```
Customer: "My name is Mike, and my phone number is +1 234567889."
Customer: "My address is 789 Goodrich Road. My ZIP code is 55437. State of, Minnesota. City is Minneapolis."

✅ Goal transitioned: DESIGN_SOLUTION
Agent: "I will create a solution plan for your backyard assistance..."

❌ BUT: No customer_get called
❌ No customer_create called
❌ No employee_list called
❌ Flow stuck - agent just talked but didn't DO anything
```

**Root Cause:**
- `customer_profile_workflow` was **documented but never executed**
- DESIGN_SOLUTION used `planner_agent` (no MCP tool access)
- mcp_agent is reactive - waits for LLM to call tools
- conversational_agent doesn't know to invoke customer tools

---

## ✅ Solution: New Agentic Flow

### Old Flow (Broken)
```
1. UNDERSTAND_REQUEST
2. GATHER_REQUIREMENTS → collected name, phone, address
3. DESIGN_SOLUTION ❌ (planner_agent just talked, didn't execute tools)
4. EXECUTE_SOLUTION
5. CONFIRM_RESOLUTION
```

### New Flow (Fixed)
```
1. UNDERSTAND_REQUEST
   └─ Collect service.primary_request

2. GATHER_REQUIREMENTS
   └─ Collect customer.phone, customer.name, customer.address_* (fine-grained)

3. MANAGE_CUSTOMER_PROFILE ⭐ NEW
   └─ Primary: mcp_agent
   └─ Execute customer_profile_workflow:
      a) customer_get (search by phone)
      b) If found: customer_update
      c) If not found: customer_create
      d) Store customer.id in context
   └─ Success criteria: customer.id is set

4. DESIGN_SOLUTION ⭐ UPDATED
   └─ Primary: mcp_agent (changed from planner_agent)
   └─ Execute solution_design_workflow:
      a) Search service catalog
      b) employee_list (find available employees)
      c) Select best employee
      d) Store assignment.employee_id
      e) Create solution plan
      f) Present to customer
   └─ Success criteria: operations.solution_plan + assignment.employee_id

5. EXECUTE_SOLUTION
   └─ task_create (auto-enriched with customer + conversation)
   └─ person_calendar_book (auto-enriched with attendees + task)

6. CONFIRM_RESOLUTION
   └─ call_hangup
```

---

## 🎯 Changes Made

### 1. Added MANAGE_CUSTOMER_PROFILE Goal

```json
{
  "goal_id": "MANAGE_CUSTOMER_PROFILE",
  "description": "Look up existing customer or create new customer profile",
  "goal_type": "execution",
  "primary_agent": "mcp_agent",
  "success_criteria": {
    "mandatory_fields": ["customer.id"]
  },
  "auto_advance_conditions": [
    {
      "type": "semi_deterministic",
      "json_path": "customer.id",
      "operator": "is_set",
      "next_goal": "DESIGN_SOLUTION"
    }
  ]
}
```

**What it does:**
- Uses mcp_agent as primary (can call MCP tools)
- Requires customer.id to be set before advancing
- Deterministic transition (no LLM evaluation needed - fast)
- Max 3 turns (efficient)

### 2. Updated mcp_agent System Prompt

**Added explicit workflow instructions:**

```
**CUSTOMER PROFILE WORKFLOW (MANAGE_CUSTOMER_PROFILE goal):**
1. Search for existing customer: Call customer_get with phone number from context
2. If customer found: Call customer_update with any new data
3. If customer NOT found: Call customer_create with complete profile
4. Extract customer.id from response and update context
5. Confirm to user: "I've updated your profile" or "I've created your profile"

**SOLUTION DESIGN WORKFLOW (DESIGN_SOLUTION goal):**
1. Search for matching service: Call setting_list or service_list
2. Search for available employees: Call employee_list
3. Select best match employee and store assignment.employee_id
4. Create solution plan with: service type, assigned employee, timeline
5. Present plan to customer and ask for consent
```

### 3. Updated DESIGN_SOLUTION Goal

**Changed:**
- `primary_agent`: `"planner_agent"` → `"mcp_agent"` ⭐
- `goal_type`: `"planning"` → `"planning_with_mcp"` ⭐
- `success_criteria`: Added `"assignment.employee_id"` ⭐
- `auto_advance_conditions`: Added `"type": "semantic"` for both conditions

**Why:**
- mcp_agent can actually call employee_list tool
- Requires both solution plan AND assigned employee
- Semantic evaluation allows LLM to determine customer consent

### 4. Updated GATHER_REQUIREMENTS Transition

**Changed:**
- `next_goal`: `"DESIGN_SOLUTION"` → `"MANAGE_CUSTOMER_PROFILE"` ⭐

**Why:**
- Must create customer profile before designing solution
- Customer ID needed for task/project linking

---

## 🔄 Example Runtime Flow

### Scenario: New Customer "Mike" requests backyard assistance

```typescript
// 1. UNDERSTAND_REQUEST
Customer: "Hey. I need help regarding the back error."
Agent: "I understand. Could you provide more details?"
Customer: "Mean, the backyard."
✅ service.primary_request = "Backyard assistance"
→ Transition to GATHER_REQUIREMENTS

// 2. GATHER_REQUIREMENTS
Agent: "Could you please share your name and phone number?"
Customer: "My name is Mike, and my phone number is +1 234567889."
✅ customer.name = "Mike"
✅ customer.phone = "+1 234567889"

Agent: "Could you provide your address?"
Customer: "789 Goodrich Road. ZIP code is 55437. State of Minnesota. City is Minneapolis."
✅ customer.address_street = "789 Goodrich Road"
✅ customer.address_city = "Minneapolis"
✅ customer.address_state = "Minnesota"
✅ customer.address_zipcode = "55437"
→ Transition to MANAGE_CUSTOMER_PROFILE

// 3. MANAGE_CUSTOMER_PROFILE ⭐ NEW
mcp_agent executes:
  1. customer_get({ query_primary_phone: "+1 234567889" })
     → Returns: { results: [] } (not found)

  2. customer_create({
       body_name: "Mike",
       body_primary_phone: "+1 234567889",
       body_primary_address: "789 Goodrich Road",
       body_city: "Minneapolis",
       body_province: "Minnesota",
       body_postal_code: "55437"
     })
     → Returns: { id: "cust-uuid-123" }

  3. Update context: customer.id = "cust-uuid-123"

Agent: "I've created your customer profile!"
→ Transition to DESIGN_SOLUTION (customer.id is set)

// 4. DESIGN_SOLUTION ⭐ UPDATED
mcp_agent executes:
  1. service_list({ query_name: "backyard" })
     → Returns: [{ id: "srv-1", name: "Backyard Landscaping" }]

  2. employee_list({ query_active_flag: "true" })
     → Returns: [
         { id: "emp-1", name: "John Doe", specialization: "Landscaping" },
         { id: "emp-2", name: "Jane Smith", specialization: "General" }
       ]

  3. Select best match: employee_id = "emp-1"
     Update context: assignment.employee_id = "emp-1", assignment.employee_name = "John Doe"

  4. Create solution plan:
     operations.solution_plan = "We'll assign John Doe to assess your backyard. He'll visit on [date] to provide a quote."

Agent: "Here's the plan: We'll assign John Doe (landscaping specialist) to help with your backyard. He can visit tomorrow at 2pm. Does that work for you?"
Customer: "Yes, that sounds good."
→ Transition to EXECUTE_SOLUTION

// 5. EXECUTE_SOLUTION
mcp_agent executes:
  1. task_create({
       body_name: "Backyard assistance - Mike",
       body_descr: "Auto-enriched with:
         ## Customer Information
         - Name: Mike
         - Phone: +1 234567889
         - Address: 789 Goodrich Road, Minneapolis, Minnesota, 55437

         ## Service Request
         - Request: Backyard assistance

         ## Conversation History
         ..."
     })
     → Returns: { id: "task-uuid-456" }
     Update context: operations.task_id = "task-uuid-456"

  2. person_calendar_book({
       slot_ids: ["slot-uuid"],
       body_title: "Service: Backyard assistance",
       body_instructions: "Auto-enriched with task ID, customer info",
       body_metadata: {
         attendees: [
           { name: "Mike", email: "", phone: "+1 234567889", type: "customer" },
           { name: "John Doe", email: "john@huronhome.ca", type: "employee" }
         ],
         task_id: "task-uuid-456"
       }
     })
     → Returns: { id: "calendar-uuid" }

Agent: "Great! I've created the task and scheduled John Doe for tomorrow at 2pm. You'll receive a confirmation."
→ Transition to CONFIRM_RESOLUTION

// 6. CONFIRM_RESOLUTION
Agent: "Is there anything else I can help with?"
Customer: "No, that's all. Thank you!"
Agent: "Thank you for choosing Huron Home Services! Have a great day!"
mcp_agent: call_hangup()
→ END
```

---

## 📊 Verification Checklist

✅ **6 Goals Total**
- UNDERSTAND_REQUEST
- GATHER_REQUIREMENTS
- MANAGE_CUSTOMER_PROFILE ⭐ NEW
- DESIGN_SOLUTION ⭐ UPDATED
- EXECUTE_SOLUTION
- CONFIRM_RESOLUTION

✅ **Goal Transitions**
- GATHER_REQUIREMENTS → MANAGE_CUSTOMER_PROFILE (new)
- MANAGE_CUSTOMER_PROFILE → DESIGN_SOLUTION (new)
- DESIGN_SOLUTION → EXECUTE_SOLUTION (existing)

✅ **mcp_agent Workflows**
- Customer profile workflow (explicit instructions)
- Solution design workflow (explicit instructions)
- Tool enrichment rules (existing)

✅ **Success Criteria**
- MANAGE_CUSTOMER_PROFILE: customer.id required
- DESIGN_SOLUTION: operations.solution_plan + assignment.employee_id required

✅ **Fine-Grained Address**
- All goals use address_street, address_city, address_state, address_zipcode
- No deprecated customer.address field

---

## 🚀 Expected Behavior After Fix

**Before (Broken):**
```
Customer provides data → Agent says "I'll create a plan" → Nothing happens → Stuck
```

**After (Fixed):**
```
Customer provides data
  → Agent calls customer_get (lookup)
  → Agent calls customer_create (new profile)
  → Stores customer.id
  → Agent calls employee_list (find available)
  → Agent selects employee
  → Agent presents plan with assigned employee
  → Customer consents
  → Agent calls task_create (with enriched data)
  → Agent calls person_calendar_book (with attendees)
  → Confirmation
  → Done!
```

---

## 🎯 Key Improvements

1. **Automatic Customer Profile Management**
   - No manual intervention needed
   - Handles both new and existing customers
   - Updates profiles incrementally

2. **Employee Assignment**
   - Searches available employees
   - Assigns best match
   - Includes in solution plan

3. **Deterministic Transitions**
   - MANAGE_CUSTOMER_PROFILE uses semi_deterministic (fast)
   - No unnecessary LLM calls for simple checks

4. **Clear Workflow Instructions**
   - mcp_agent knows exactly what to do in each goal
   - Step-by-step execution
   - Confirmation messages to user

5. **Data Enrichment**
   - task_create auto-enriched with customer data
   - person_calendar_book auto-enriched with attendees
   - Conversation history preserved

---

## 📝 Files Modified

1. `agent_config.json`
   - Added MANAGE_CUSTOMER_PROFILE goal (lines 76-101)
   - Updated GATHER_REQUIREMENTS transition (line 72)
   - Updated DESIGN_SOLUTION goal (lines 102-132)
   - Updated mcp_agent system_prompt (lines 275)

---

**End of Document**
