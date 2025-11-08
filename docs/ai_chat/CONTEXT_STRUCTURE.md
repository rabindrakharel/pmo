# Context Structure & Data Extraction Fields

> **Status:** ✅ Fully Implemented
>
> **Branch:** `claude/fix-context-data-api-011CUuhgpTfBzse9X6tDieKZ`

---

## 📋 Overview

The AI chat system uses a nested context structure with `data_extraction_fields` object to organize customer and task-related data separately from system fields.

---

## 🗂️ Context Structure

### **Before (Flat Structure):**
```json
{
  "agent_session_id": "uuid",
  "who_are_you": "...",
  "customer_name": "",
  "customer_phone_number": "",
  "customer_email": "",
  "customer_id": "",
  "customers_main_ask": "",
  "matching_service_catalog_to_solve_customers_issue": "",
  "task_id": "",
  "appointment_details": "",
  "next_course_of_action": "",
  "next_node_to_go_to": "GREET_CUSTOMER",
  "node_traversal_path": [],
  "summary_of_conversation_on_each_step_until_now": [],
  "flags": {}
}
```

### **After (Nested Structure):**
```json
{
  "agent_session_id": "uuid",
  "who_are_you": "...",
  "data_extraction_fields": {
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
    "assigned_employee_name": ""
  },
  "next_course_of_action": "",
  "next_node_to_go_to": "GREET_CUSTOMER",
  "node_traversed": [],  // Renamed from node_traversal_path
  "summary_of_conversation_on_each_step_until_now": [],
  "flags": {}
}
```

---

## 🔄 Key Changes

### 1. **Nested Extraction Fields**
- All customer/task-related fields grouped under `data_extraction_fields`
- Clear separation between system fields and extracted data
- Easier to identify what DataExtractionAgent manages

### 2. **Renamed Array**
- `node_traversal_path` → `node_traversed`
- Shorter, clearer name
- Consistent with "past tense" naming convention

### 3. **Additional Fields**
New fields added to `data_extraction_fields`:
- `related_entities_for_customers_ask` - Related PMO entities
- `task_name` - Human-readable task name
- `project_id` - Project UUID if task linked to project
- `assigned_employee_id` - Employee UUID
- `assigned_employee_name` - Employee name for communication

---

## 📁 Session Memory Data Files

### **File Naming:**
- **Before:** `context_<sessionId>.json`
- **After:** `session_<sessionId>_memory_data.json`

### **Location:**
`./logs/contexts/session_{sessionId}_memory_data.json`

### **Example File:**
```json
{
  "metadata": {
    "sessionId": "abc-123",
    "chatSessionId": "chat-456",
    "userId": "user-789",
    "currentNode": "Communicate_To_Customer_Before_Action",
    "previousNode": "Plan",
    "completed": false,
    "conversationEnded": false,
    "lastUpdated": "2025-11-08T12:34:56.789Z",
    "action": "navigation:Plan→Communicate_To_Customer_Before_Action"
  },
  "context": {
    "agent_session_id": "abc-123",
    "who_are_you": "You are a polite customer service agent...",
    "data_extraction_fields": {
      "customer_name": "John Smith",
      "customer_phone_number": "555-1234",
      "customer_email": "",
      "customer_id": "cust-789",
      "customers_main_ask": "Roof leak repair",
      "matching_service_catalog_to_solve_customers_issue": "Roofing",
      "related_entities_for_customers_ask": "",
      "task_id": "task-123",
      "task_name": "Roof Leak Repair Task",
      "appointment_details": "",
      "project_id": "",
      "assigned_employee_id": "",
      "assigned_employee_name": ""
    },
    "next_course_of_action": "Wait for customer approval to execute plan",
    "next_node_to_go_to": "Execute_Plan_Using_MCP",
    "node_traversed": [
      "GREET_CUSTOMER",
      "Extract_Customer_Issue",
      "Acknowledge_And_Empathize",
      "Try_To_Gather_Customers_Data",
      "Check_IF_existing_customer",
      "Plan",
      "Communicate_To_Customer_Before_Action"
    ],
    "summary_of_conversation_on_each_step_until_now": [
      {
        "customer": "My roof is leaking, I'm John Smith, 555-1234",
        "agent": "Hello! I see you're having a roof leak issue."
      },
      {
        "customer": "(system auto-advance)",
        "agent": "I understand you're dealing with a roof leak."
      },
      {
        "customer": "(system auto-advance)",
        "agent": "Thank you, John. I have your information."
      },
      {
        "customer": "(system auto-advance - MCP execution)",
        "agent": "(MCP: Check customer DB)"
      },
      {
        "customer": "(system auto-advance - MCP execution)",
        "agent": "(MCP: Create task plan)"
      },
      {
        "customer": "(system auto-advance)",
        "agent": "I've created a task for your roof leak repair. Shall I proceed?"
      }
    ],
    "flags": {
      "greet_flag": 1,
      "extract_issue_flag": 1,
      "acknowledge_empathize_flag": 1,
      "check_customer_flag": 1,
      "plan_flag": 1
    }
  },
  "messages": [
    {
      "role": "user",
      "content": "My roof is leaking, I'm John Smith, 555-1234",
      "timestamp": "2025-11-08T12:34:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Hello! I see you're having a roof leak issue.",
      "timestamp": "2025-11-08T12:34:01.123Z"
    },
    {
      "role": "assistant",
      "content": "I understand you're dealing with a roof leak.",
      "timestamp": "2025-11-08T12:34:02.456Z"
    },
    {
      "role": "assistant",
      "content": "Thank you, John. I have your information.",
      "timestamp": "2025-11-08T12:34:03.789Z"
    },
    {
      "role": "assistant",
      "content": "I've created a task for your roof leak repair. Shall I proceed?",
      "timestamp": "2025-11-08T12:34:56.789Z"
    }
  ]
}
```

---

## 🎯 Benefits

### **Organized Structure:**
```javascript
// System fields (top-level)
context.agent_session_id
context.who_are_you
context.next_node_to_go_to
context.node_traversed
context.flags

// Extracted data (nested)
context.data_extraction_fields.customer_name
context.data_extraction_fields.customers_main_ask
context.data_extraction_fields.task_id
```

### **Clear Ownership:**
- **DataExtractionAgent** → Updates `data_extraction_fields` only
- **Orchestrator** → Updates system fields (node_traversed, flags, etc.)
- **Navigator** → Updates navigation fields (next_node_to_go_to, etc.)

### **Better Logs:**
```
✓ data_extraction_fields.customer_name: "(empty)" → "John Smith"
✓ data_extraction_fields.customers_main_ask: "(empty)" → "Roof leak repair"
```

---

## 🔧 How to Access Fields

### **Reading Fields:**
```typescript
// Old way (flat)
const customerName = state.context.customer_name;
const mainAsk = state.context.customers_main_ask;

// New way (nested)
const customerName = state.context.data_extraction_fields?.customer_name;
const mainAsk = state.context.data_extraction_fields?.customers_main_ask;
```

### **Updating Fields:**
```typescript
// DataExtractionAgent tool call
updateContext({
  "customer_name": "John Smith",
  "customers_main_ask": "Roof leak repair"
});

// Internally becomes:
{
  data_extraction_fields: {
    customer_name: "John Smith",
    customers_main_ask: "Roof leak repair"
  }
}
```

---

## 📊 Configuration

### **Agent Config Template:**
Located in `agent_config.json` under `global_context_schema_semantics.session_memory_data.template`:

```json
{
  "session_memory_data": {
    "description": "CRITICAL: Orchestrator MUST initialize context with this exact structure at session start.",
    "template": {
      "agent_session_id": "<session_uuid>",
      "who_are_you": "You are a polite customer service agent...",
      "data_extraction_fields": {
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
        "assigned_employee_name": ""
      },
      "next_course_of_action": "",
      "next_node_to_go_to": "GREET_CUSTOMER",
      "node_traversed": [],
      "summary_of_conversation_on_each_step_until_now": [],
      "flags": {}
    }
  }
}
```

---

## 📁 Files Modified

### **Configuration:**
✅ `agent_config.json` - Updated session_memory_data template with nested structure
✅ `agent_config.json` - Updated ALL agent profiles with accurate nested references

### **Core Services:**
✅ `data-extraction-agent.service.ts` - Reads/writes nested data_extraction_fields
✅ `local-tools.ts` - Updates nested structure in updateContext tool
✅ `agent-context.service.ts` - Handles nested object merge + renamed field
✅ `context-initializer.service.ts` - Initializes nested structure dynamically
✅ `agent-orchestrator.service.ts` - Access fields via data_extraction_fields

### **Agent Profile Documentation:**
✅ `node_navigator_agent` - Updated references to `context.data_extraction_fields.*`
✅ `worker_mcp_agent` - Updated to show nested structure access patterns
✅ `validator_agent` - Updated validation logic to reference nested fields
✅ `data_extraction_agent` - Updated to document nested structure updates
✅ `field_semantics` - Added `data_extraction_fields` entry, renamed `node_traversed`

---

## ✅ Commits

**Branch:** `claude/fix-context-data-api-011CUuhgpTfBzse9X6tDieKZ`

1. **`f381f06`** - "refactor(context): Restructure context with nested data_extraction_fields"
   - Core implementation of nested structure
   - Updated all services to handle nested fields
   - Changed `node_traversal_path` → `node_traversed`

2. **`c95d703`** - "docs(agent-config): Update agent profiles with accurate nested context references"
   - Updated ALL agent profile documentation
   - Added `data_extraction_fields` entry in field_semantics
   - Ensured all references use `context.data_extraction_fields.{field_name}`

3. **`b6646a5`** - "refactor(context): Rename context files to session_{id}_memory_data.json"
   - Renamed context files for better clarity
   - Updated all file path references
   - Better naming that reflects purpose (session's persistent memory data)

4. **`30b147d`** - "refactor(config): Rename initial_context_template to session_memory_data"
   - Renamed template in agent_config.json
   - Replaced all `dag.json` → `agent_config.json` references
   - Clarified separation: Data (session files) vs Config (agent_config.json)

5. **`37d2af9`** - "docs: Clean up obsolete dag.json references"
   - Completed cleanup of obsolete dag.json references
   - Clear documentation throughout codebase

---

**Last Updated:** 2025-11-08
