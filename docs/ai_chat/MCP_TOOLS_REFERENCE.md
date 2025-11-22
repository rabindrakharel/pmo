# MCP Tools Reference - Complete Catalog

> **Model Context Protocol (MCP) Tools** - Complete reference for AI agent function calling

**Version:** 6.1.0
**Last Updated:** 2025-11-11
**Total Tools:** 100+ API endpoints

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Tool Categories](#tool-categories)
3. [Session Memory Tools](#session-memory-tools)
4. [Customer Tools](#customer-tools)
5. [Task Tools](#task-tools)
6. [Employee Tools](#employee-tools)
7. [Calendar Tools](#calendar-tools)
8. [Project Tools](#project-tools)
9. [Settings Tools](#settings-tools)
10. [Tool Enrichment](#tool-enrichment)
11. [Adding New Tools](#adding-new-tools)

---

## 🎯 Overview

### What are MCP Tools?

**MCP (Model Context Protocol) Tools** are OpenAI function calling tools that expose PMO API endpoints to AI agents. They allow agents to:

- Search and retrieve data (customers, tasks, projects)
- Create and update records (customer profiles, service tasks)
- Book appointments (calendar management)
- Query settings (dropdown options, service catalogs)
- Manage session memory (conversation context)

### How Tools Work

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP TOOL EXECUTION FLOW                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Agent Receives User Message                             │
│     "I need help with roof holes"                           │
│                                                              │
│  2. LLM Analyzes Context + Available Tools                  │
│     → Tool: update_data_extraction_fields                   │
│     → Parameters: { service: { primary_request: "Roof" } }  │
│                                                              │
│  3. MCP Adapter Executes Tool                               │
│     → Calls SessionMemoryDataService.updateSessionMemory()  │
│     → Updates session context                               │
│                                                              │
│  4. Tool Returns Result                                     │
│     → { success: true, updated_fields: [...] }              │
│                                                              │
│  5. Agent Uses Result in Response                           │
│     "I understand you need roof repair. May I have your     │
│      phone number?"                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Tool Selection Process

1. **Agent Profile** specifies available tool categories
2. **MCP Adapter** filters API manifest by category
3. **OpenAI** receives tools as function schemas
4. **LLM** decides which tools to call based on conversation
5. **MCP Adapter** executes selected tools
6. **Results** are incorporated into agent response

---

## 📁 Tool Categories

| Category | Tools | Primary Use Case |
|----------|-------|------------------|
| **Session Memory** | 4 | Store and retrieve conversation context |
| **Customer** | 6 | Customer CRUD operations |
| **Task** | 10 | Task management and assignment |
| **Employee** | 2 | Employee lookup and details |
| **Calendar** | 8 | Appointment booking and availability |
| **Project** | 10 | Project management and child entities |
| **Settings** | 2 | Dropdown options and service catalogs |
| **Authentication** | 5 | User authentication and permissions |
| **Linkage** | 3 | Entity relationship management |

**Total:** 50+ filtered tools (from 100+ total APIs)

---

## 💾 Session Memory Tools

**Category:** `SessionMemory`
**Purpose:** Manage conversation context and extracted data
**File:** `apps/api/src/modules/chat/orchestrator/mcp/session-memory-data-mcp.tools.ts`

### 1. `get_session_memory_data`

**Description:** Retrieve complete session memory data

**Parameters:**
```typescript
{
  session_id: string; // Session UUID
}
```

**Returns:**
```json
{
  "customer": {
    "name": "John Smith",
    "phone": "647-646-7996",
    "email": "john@example.com",
    "address_street": "123 Main St",
    "address_city": "Toronto",
    "cust_id": "uuid-123",
    "existing_customer_flag": true
  },
  "service": {
    "primary_request": "Roof hole repair",
    "urgency": "high",
    "service_category": "Roofing"
  },
  "operations": {
    "solution_plan": "...",
    "task_id": "task-456",
    "employee_id": "emp-789",
    "employee_name": "Bob Smith"
  },
  "project": {
    "project_id": "proj-abc",
    "project_name": "Project Alpha"
  },
  "assignment": {
    "appointment_id": "appt-def",
    "appointment_time": "2025-11-15T10:00:00Z"
  }
}
```

**Example Usage:**
```json
{
  "function": "get_session_memory_data",
  "arguments": {
    "session_id": "abc-123"
  }
}
```

---

### 2. `get_context_data`

**Description:** Lightweight retrieval of specific context fields

**Parameters:**
```typescript
{
  session_id: string;
  fields: string[]; // Array of dot-notation paths
}
```

**Example:**
```json
{
  "function": "get_context_data",
  "arguments": {
    "session_id": "abc-123",
    "fields": ["customer.phone", "customer.name", "service.primary_request"]
  }
}
```

**Returns:**
```json
{
  "customer.phone": "647-646-7996",
  "customer.name": "John Smith",
  "service.primary_request": "Roof hole repair"
}
```

**Benefits:**
- Faster than full memory retrieval
- Reduced token usage
- Targeted data access

---

### 3. `update_data_extraction_fields`

**Description:** Update session memory with extracted data (deep merge)

**Parameters:**
```typescript
{
  session_id: string;
  updates: Partial<SessionMemoryData>; // Nested updates
}
```

**Deep Merge Behavior:**

```javascript
// Existing memory
{
  customer: { name: "John" },
  service: { primary_request: "Roof repair" }
}

// Update
{
  customer: { phone: "555-1234" }
}

// Result (deep merge)
{
  customer: { name: "John", phone: "555-1234" }, // ✅ Merged
  service: { primary_request: "Roof repair" }    // ✅ Preserved
}
```

**Example:**
```json
{
  "function": "update_data_extraction_fields",
  "arguments": {
    "session_id": "abc-123",
    "updates": {
      "customer": {
        "phone": "647-646-7996",
        "name": "John Smith"
      },
      "service": {
        "primary_request": "Roof hole repair",
        "urgency": "high"
      }
    }
  }
}
```

**Common Use Cases:**
- Store customer contact info during conversation
- Save service request details
- Record customer preferences
- Track data extraction progress

---

### 4. `update_session_memory_data`

**Description:** Update session metadata (conversation stats, summary)

**Parameters:**
```typescript
{
  session_id: string;
  updates: {
    conversation_turn_count?: number;
    node_path?: string[]; // Goal traversal path
    summary?: string;
  };
}
```

**Example:**
```json
{
  "function": "update_session_memory_data",
  "arguments": {
    "session_id": "abc-123",
    "updates": {
      "conversation_turn_count": 5,
      "node_path": ["WARM_GREETINGS", "ELICIT_INFO", "LOOKUP"],
      "summary": "Customer requested roof repair, provided contact info"
    }
  }
}
```

---

## 👤 Customer Tools

**Category:** `Customer`
**Purpose:** Customer CRUD operations
**API Base:** `/api/v1/customer`

### 1. `customer_list`

**Description:** Search and list customers

**Parameters:**
```typescript
{
  query_search?: string;  // Search by name, email, phone
  query_limit?: number;   // Pagination limit (default: 20)
  query_offset?: number;  // Pagination offset
  active?: boolean;       // Filter active customers
}
```

**Example:**
```json
{
  "function": "customer_list",
  "arguments": {
    "query_search": "John Smith",
    "query_limit": 5
  }
}
```

**Returns:**
```json
{
  "data": [
    {
      "id": "cust-uuid-123",
      "name": "John Smith",
      "primary_phone": "647-646-7996",
      "primary_email": "john@example.com",
      "customer_code": "CS-20251110-001",
      "cust_type": "residential",
      "active_flag": true
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 5
}
```

---

### 2. `customer_get`

**Description:** Get single customer by ID

**Parameters:**
```typescript
{
  id: string; // Customer UUID
}
```

**Example:**
```json
{
  "function": "customer_get",
  "arguments": {
    "id": "cust-uuid-123"
  }
}
```

**Returns:**
```json
{
  "id": "cust-uuid-123",
  "customer_code": "CS-20251110-001",
  "name": "John Smith",
  "primary_phone": "647-646-7996",
  "primary_email": "john@example.com",
  "primary_address": "123 Main St, Toronto, ON, M1M 1M1",
  "cust_type": "residential",
  "cust_number": 1001,
  "active_flag": true,
  "created_ts": "2025-11-10T10:00:00Z"
}
```

---

### 3. `customer_create`

**Description:** Create new customer profile

**Parameters:**
```typescript
{
  name: string;          // Full name (required)
  primary_phone: string; // Phone number (required)
  primary_email?: string;
  primary_address?: string;
  cust_type?: string;    // 'residential' | 'commercial'
}
```

**Auto-Generated Fields:**
- `customer_code` - Format: `CS-YYYYMMDD-###`
- `cust_number` - Auto-incremented integer

**Example:**
```json
{
  "function": "customer_create",
  "arguments": {
    "name": "John Smith",
    "primary_phone": "647-646-7996",
    "primary_email": "john@example.com",
    "primary_address": "123 Main St, Toronto, ON, M1M 1M1",
    "cust_type": "residential"
  }
}
```

**Returns:**
```json
{
  "id": "cust-uuid-123",
  "customer_code": "CS-20251110-001",
  "cust_number": 1001,
  "name": "John Smith",
  "primary_phone": "647-646-7996"
}
```

---

### 4. `customer_update`

**Description:** Update existing customer profile

**Parameters:**
```typescript
{
  id: string;             // Customer UUID (required)
  name?: string;
  primary_phone?: string;
  primary_email?: string;
  primary_address?: string;
  cust_type?: string;
  active_flag?: boolean;
}
```

**Example:**
```json
{
  "function": "customer_update",
  "arguments": {
    "id": "cust-uuid-123",
    "primary_email": "john.smith@newemail.com",
    "primary_address": "456 New St, Toronto, ON, M2M 2M2"
  }
}
```

---

### 5. `customer_search_by_phone`

**Description:** Find customer by phone number (exact match)

**Parameters:**
```typescript
{
  phone: string; // Phone number (format: 6476467996 or 647-646-7996)
}
```

**Example:**
```json
{
  "function": "customer_search_by_phone",
  "arguments": {
    "phone": "6476467996"
  }
}
```

**Returns:**
```json
{
  "found": true,
  "customer": {
    "id": "cust-uuid-123",
    "name": "John Smith",
    "primary_phone": "647-646-7996"
  }
}
```

---

### 6. `customer_get_interactions`

**Description:** Get customer interaction history

**Parameters:**
```typescript
{
  id: string;        // Customer UUID
  query_limit?: number;
}
```

**Example:**
```json
{
  "function": "customer_get_interactions",
  "arguments": {
    "id": "cust-uuid-123",
    "query_limit": 10
  }
}
```

**Returns:**
```json
{
  "data": [
    {
      "id": "interaction-uuid",
      "interaction_type": "chat",
      "channel": "web_widget",
      "conversation_history": [...],
      "created_ts": "2025-11-10T10:00:00Z"
    }
  ]
}
```

---

## ✅ Task Tools

**Category:** `Task`
**Purpose:** Service task management
**API Base:** `/api/v1/task`

### 1. `task_list`

**Description:** Search and list tasks

**Parameters:**
```typescript
{
  query_search?: string;
  query_limit?: number;
  query_offset?: number;
  project_id?: string;              // Filter by project
  assigned_to_employee_id?: string; // Filter by assignee
  dl__task_stage?: string;          // Filter by status
  task_type?: string;
  task_category?: string;
  client_id?: string;
  worksite_id?: string;
}
```

**Example:**
```json
{
  "function": "task_list",
  "arguments": {
    "assigned_to_employee_id": "emp-uuid-789",
    "dl__task_stage": "OPEN",
    "query_limit": 20
  }
}
```

**Returns:**
```json
{
  "data": [
    {
      "id": "task-uuid-456",
      "title": "Roof hole repair",
      "description": "Customer: John Smith...",
      "dl__task_stage": "OPEN",
      "dl__task_priority": "HIGH",
      "assigned_to_employee_id": "emp-uuid-789",
      "assignee_name": "Bob Smith",
      "estimated_hours": 4,
      "actual_hours": 0,
      "due_date": "2025-11-20",
      "created_ts": "2025-11-10T10:00:00Z"
    }
  ],
  "total": 5,
  "page": 1
}
```

---

### 2. `task_get`

**Description:** Get single task by ID

**Parameters:**
```typescript
{
  id: string; // Task UUID
}
```

**Example:**
```json
{
  "function": "task_get",
  "arguments": {
    "id": "task-uuid-456"
  }
}
```

---

### 3. `task_create`

**Description:** Create new service task

**Parameters:**
```typescript
{
  title: string;                   // Task title (required)
  description?: string;
  customer_id?: string;            // Link to customer (recommended)
  assigned_to_employee_id?: string;
  dl__task_stage?: string;         // Default: 'OPEN'
  dl__task_priority?: string;      // Default: 'MEDIUM'
  task_type?: string;
  task_category?: string;
  estimated_hours?: number;
  due_date?: string;               // ISO 8601 date
  project_id?: string;             // Link to project
}
```

**Auto-Enrichment:**
The MCP adapter automatically enriches the description with customer context:

```typescript
// Agent calls
task_create({
  title: "Roof repair",
  description: "Fix roof holes",
  customer_id: "cust-uuid-123"
})

// MCP Adapter enriches
{
  title: "Roof repair",
  description: `Customer: John Smith
Phone: +1234567890
Address: 123 Main St, Toronto, ON, M1M 1M1
Service Request: Roof hole repair (urgent)

Details:
Fix roof holes`,
  customer_id: "cust-uuid-123"
}
```

**Example:**
```json
{
  "function": "task_create",
  "arguments": {
    "title": "Roof hole repair",
    "description": "Customer reported holes in roof requiring urgent repair",
    "customer_id": "cust-uuid-123",
    "assigned_to_employee_id": "emp-uuid-789",
    "dl__task_stage": "OPEN",
    "dl__task_priority": "HIGH",
    "task_category": "Roofing",
    "estimated_hours": 4,
    "due_date": "2025-11-20"
  }
}
```

**Returns:**
```json
{
  "id": "task-uuid-456",
  "title": "Roof hole repair",
  "dl__task_stage": "OPEN",
  "created_ts": "2025-11-10T10:00:00Z"
}
```

---

### 4. `task_update`

**Description:** Update existing task

**Parameters:**
```typescript
{
  id: string;                      // Task UUID (required)
  title?: string;
  description?: string;
  dl__task_stage?: string;
  dl__task_priority?: string;
  assigned_to_employee_id?: string;
  actual_hours?: number;
  due_date?: string;
}
```

**Example:**
```json
{
  "function": "task_update",
  "arguments": {
    "id": "task-uuid-456",
    "dl__task_stage": "IN_PROGRESS",
    "actual_hours": 2
  }
}
```

---

### 5. `task_get_assignees`

**Description:** Get task assignees (employee details)

**Parameters:**
```typescript
{
  id: string; // Task UUID
}
```

**Returns:**
```json
{
  "assignees": [
    {
      "employee_id": "emp-uuid-789",
      "employee_name": "Bob Smith",
      "role": "Technician",
      "email": "bob.smith@example.com"
    }
  ]
}
```

---

### 6. `task_get_case_notes`

**Description:** Get task case notes/comments

**Parameters:**
```typescript
{
  taskId: string;
  query_limit?: number;
}
```

---

### 7. `task_get_activity`

**Description:** Get task activity log

**Parameters:**
```typescript
{
  taskId: string;
  query_limit?: number;
}
```

**Returns:**
```json
{
  "data": [
    {
      "id": "activity-uuid",
      "action": "status_change",
      "from_value": "OPEN",
      "to_value": "IN_PROGRESS",
      "changed_by": "emp-uuid-789",
      "changed_by_name": "Bob Smith",
      "created_ts": "2025-11-10T12:00:00Z"
    }
  ]
}
```

---

## 👷 Employee Tools

**Category:** `Employee`
**Purpose:** Employee lookup and details
**API Base:** `/api/v1/employee`

### 1. `employee_list`

**Description:** List all employees

**Parameters:**
```typescript
{
  query_search?: string;  // Search by name, email
  query_limit?: number;
  active?: boolean;       // Filter active employees
  role?: string;          // Filter by role (Technician, Plumber, etc.)
}
```

**Example:**
```json
{
  "function": "employee_list",
  "arguments": {
    "active": true,
    "role": "Technician",
    "query_limit": 50
  }
}
```

**Returns:**
```json
{
  "data": [
    {
      "id": "emp-uuid-789",
      "employee_code": "EMP-001",
      "name": "Bob Smith",
      "email": "bob.smith@example.com",
      "primary_phone": "416-555-1234",
      "role_name": "Technician",
      "position_name": "Senior Technician",
      "active_flag": true,
      "skills": ["Roofing", "Electrical", "Plumbing"]
    }
  ],
  "total": 10
}
```

---

### 2. `employee_get`

**Description:** Get single employee by ID

**Parameters:**
```typescript
{
  id: string; // Employee UUID
}
```

**Example:**
```json
{
  "function": "employee_get",
  "arguments": {
    "id": "emp-uuid-789"
  }
}
```

**Returns:**
```json
{
  "id": "emp-uuid-789",
  "employee_code": "EMP-001",
  "name": "Bob Smith",
  "email": "bob.smith@example.com",
  "primary_phone": "416-555-1234",
  "role_name": "Technician",
  "position_name": "Senior Technician",
  "skills": ["Roofing", "Electrical", "Plumbing"],
  "availability": "available",
  "active_flag": true
}
```

---

## 📅 Calendar Tools

**Category:** `Calendar`
**Purpose:** Appointment booking and availability
**API Base:** `/api/v1/calendar`

### 1. `person_calendar_book`

**Description:** Book appointment on employee calendar

**Parameters:**
```typescript
{
  person_id: string;     // Employee UUID (required)
  start_time: string;    // ISO 8601 datetime (required)
  end_time: string;      // ISO 8601 datetime (required)
  title: string;         // Event title (required)
  description?: string;
  task_id?: string;      // Link to task
  customer_id?: string;
  location?: string;
  event_type?: string;   // 'appointment' | 'meeting' | 'task'
}
```

**Example:**
```json
{
  "function": "person_calendar_book",
  "arguments": {
    "person_id": "emp-uuid-789",
    "start_time": "2025-11-15T10:00:00Z",
    "end_time": "2025-11-15T14:00:00Z",
    "title": "Roof repair - John Smith",
    "description": "Fix roof holes at 123 Main St",
    "task_id": "task-uuid-456",
    "customer_id": "cust-uuid-123",
    "location": "123 Main St, Toronto, ON",
    "event_type": "appointment"
  }
}
```

**Returns:**
```json
{
  "id": "appt-uuid-def",
  "person_id": "emp-uuid-789",
  "start_time": "2025-11-15T10:00:00Z",
  "end_time": "2025-11-15T14:00:00Z",
  "title": "Roof repair - John Smith",
  "status": "booked",
  "created_ts": "2025-11-10T10:00:00Z"
}
```

---

### 2. `person_calendar_list`

**Description:** Get employee calendar events (availability check)

**Parameters:**
```typescript
{
  person_id: string;    // Employee UUID (required)
  start_date?: string;  // ISO 8601 date
  end_date?: string;    // ISO 8601 date
  query_limit?: number;
}
```

**Example:**
```json
{
  "function": "person_calendar_list",
  "arguments": {
    "person_id": "emp-uuid-789",
    "start_date": "2025-11-15",
    "end_date": "2025-11-20"
  }
}
```

**Returns:**
```json
{
  "data": [
    {
      "id": "event-uuid",
      "start_time": "2025-11-15T10:00:00Z",
      "end_time": "2025-11-15T14:00:00Z",
      "title": "Roof repair - John Smith",
      "status": "booked",
      "task_id": "task-uuid-456"
    }
  ],
  "available_slots": [
    {
      "start_time": "2025-11-16T09:00:00Z",
      "end_time": "2025-11-16T17:00:00Z"
    }
  ]
}
```

---

### 3. `person_calendar_cancel`

**Description:** Cancel calendar appointment

**Parameters:**
```typescript
{
  id: string;          // Calendar event UUID
  person_id: string;   // Employee UUID
  reason?: string;
}
```

---

### 4. `person_calendar_update`

**Description:** Update calendar appointment

**Parameters:**
```typescript
{
  id: string;          // Calendar event UUID
  person_id: string;   // Employee UUID
  start_time?: string;
  end_time?: string;
  title?: string;
  description?: string;
  status?: string;     // 'booked' | 'cancelled' | 'completed'
}
```

---

## 📊 Project Tools

**Category:** `Project`
**Purpose:** Project management and child entities
**API Base:** `/api/v1/project`

### 1. `project_list`

**Description:** Search and list projects

**Parameters:**
```typescript
{
  query_search?: string;
  query_limit?: number;
  active?: boolean;
  dl__project_stage?: string;
  business_id?: string;
}
```

---

### 2. `project_get`

**Description:** Get single project by ID

**Parameters:**
```typescript
{
  id: string; // Project UUID
}
```

**Returns:**
```json
{
  "id": "proj-uuid-abc",
  "name": "Project Alpha",
  "description": "...",
  "dl__project_stage": "IN_PROGRESS",
  "budget_allocated_amt": 100000,
  "budget_spent_amt": 45000,
  "planned_start_date": "2025-01-15",
  "planned_end_date": "2025-06-30",
  "manager_id": "emp-uuid-123",
  "manager_name": "Sarah Johnson"
}
```

---

### 3. `project_get_tasks`

**Description:** Get all tasks linked to project

**Parameters:**
```typescript
{
  id: string;           // Project UUID
  query_limit?: number;
}
```

**Returns:**
```json
{
  "data": [
    {
      "id": "task-uuid-1",
      "title": "Database Migration",
      "dl__task_stage": "COMPLETED",
      "assigned_to_employee_id": "emp-uuid-789"
    },
    {
      "id": "task-uuid-2",
      "title": "API Integration",
      "dl__task_stage": "IN_PROGRESS",
      "assigned_to_employee_id": "emp-uuid-789"
    }
  ],
  "total": 15,
  "summary": {
    "completed": 8,
    "in_progress": 5,
    "open": 2
  }
}
```

---

### 4. `project_get_wiki`

**Description:** Get project wiki pages

**Parameters:**
```typescript
{
  id: string;           // Project UUID
  query_limit?: number;
}
```

---

### 5. `project_get_forms`

**Description:** Get project forms/surveys

**Parameters:**
```typescript
{
  id: string;           // Project UUID
  query_limit?: number;
}
```

---

### 6. `project_get_artifacts`

**Description:** Get project documents/artifacts

**Parameters:**
```typescript
{
  id: string;           // Project UUID
  query_limit?: number;
}
```

---

## ⚙️ Settings Tools

**Category:** `Settings`
**Purpose:** Dropdown options and service catalogs
**API Base:** `/api/v1/settings`

### 1. `setting_list`

**Description:** Get dropdown options for entity fields

**Parameters:**
```typescript
{
  category: string; // Setting category (e.g., 'dl__service_category')
}
```

**Example:**
```json
{
  "function": "setting_list",
  "arguments": {
    "category": "dl__service_category"
  }
}
```

**Returns:**
```json
{
  "data": [
    { "code": "ROOFING", "name": "Roofing", "display_order": 1 },
    { "code": "PLUMBING", "name": "Plumbing", "display_order": 2 },
    { "code": "ELECTRICAL", "name": "Electrical", "display_order": 3 },
    { "code": "HVAC", "name": "HVAC", "display_order": 4 },
    { "code": "LANDSCAPING", "name": "Landscaping", "display_order": 5 }
  ]
}
```

**Common Categories:**
- `dl__service_category` - Service types
- `dl__task_stage` - Task statuses
- `dl__task_priority` - Task priorities
- `dl__project_stage` - Project stages
- `dl__customer_type` - Customer types

---

### 2. `entity_options`

**Description:** Get all dropdown options for an entity type

**Parameters:**
```typescript
{
  entity_code: string; // 'task' | 'project' | 'customer'
}
```

**Example:**
```json
{
  "function": "entity_options",
  "arguments": {
    "entity_code": "task"
  }
}
```

**Returns:**
```json
{
  "task_stage": [
    { "code": "OPEN", "name": "Open" },
    { "code": "IN_PROGRESS", "name": "In Progress" },
    { "code": "COMPLETED", "name": "Completed" }
  ],
  "task_priority": [
    { "code": "LOW", "name": "Low" },
    { "code": "MEDIUM", "name": "Medium" },
    { "code": "HIGH", "name": "High" }
  ],
  "task_category": [
    { "code": "ROOFING", "name": "Roofing" },
    { "code": "PLUMBING", "name": "Plumbing" }
  ]
}
```

---

## 🔧 Tool Enrichment

### Auto-Context Injection

The MCP adapter automatically enriches tool calls with session context:

#### Example 1: Task Creation with Customer Context

**Agent calls:**
```json
{
  "function": "task_create",
  "arguments": {
    "title": "Roof repair",
    "description": "Fix roof holes",
    "customer_id": "cust-uuid-123"
  }
}
```

**MCP Adapter enriches (retrieves customer from session memory):**
```json
{
  "title": "Roof repair",
  "description": "Customer: John Smith (647-646-7996)
Address: 123 Main St, Toronto, ON, M1M 1M1
Service Request: Roof hole repair (urgent)

Details:
Fix roof holes",
  "customer_id": "cust-uuid-123"
}
```

**Benefit:** Technicians see full context without agent explicitly requesting customer details

---

#### Example 2: Calendar Booking with Task Context

**Agent calls:**
```json
{
  "function": "person_calendar_book",
  "arguments": {
    "person_id": "emp-uuid-789",
    "start_time": "2025-11-15T10:00:00Z",
    "end_time": "2025-11-15T14:00:00Z",
    "title": "Roof repair",
    "task_id": "task-uuid-456"
  }
}
```

**MCP Adapter enriches (retrieves task + customer from session memory):**
```json
{
  "person_id": "emp-uuid-789",
  "start_time": "2025-11-15T10:00:00Z",
  "end_time": "2025-11-15T14:00:00Z",
  "title": "Roof repair - John Smith (647-646-7996)",
  "description": "Task: Roof hole repair
Customer: John Smith
Address: 123 Main St, Toronto, ON, M1M 1M1
Phone: 647-646-7996",
  "location": "123 Main St, Toronto, ON, M1M 1M1",
  "task_id": "task-uuid-456"
}
```

**Benefit:** Calendar event has complete context for technician

---

### Auto-Field Generation

Certain tools automatically generate fields:

#### `customer_create`

```json
// Agent calls
{
  "name": "John Smith",
  "primary_phone": "647-646-7996"
}

// API generates
{
  "name": "John Smith",
  "primary_phone": "647-646-7996",
  "customer_code": "CS-20251110-001",  // Auto: CS-YYYYMMDD-###
  "cust_number": 1001                  // Auto: incremented
}
```

---

## ➕ Adding New Tools

### Step 1: Create API Endpoint

Create API route in `/apps/api/src/modules/YOUR_MODULE/routes.ts`:

```typescript
fastify.get('/api/v1/service', {
  preHandler: [fastify.authenticate],
  schema: {
    querystring: Type.Object({
      category: Type.Optional(Type.String())
    })
  }
}, async (request, reply) => {
  const { category } = request.query as any;
  const services = await serviceService.list({ category });
  return { data: services };
});
```

---

### Step 2: Add to API Manifest

Edit `/apps/mcp-server/src/api-manifest.ts`:

```typescript
{
  name: 'service_list',
  method: 'GET',
  path: '/api/v1/service',
  description: 'List available home services (roof repair, plumbing, etc.)',
  requiresAuth: true,
  category: 'Settings',
  parameters: {
    query: {
      category: 'Filter by category'
    }
  }
}
```

---

### Step 3: Restart API Server

```bash
./tools/restart-api.sh
```

**MCP Adapter automatically:**
1. Discovers new endpoint from API manifest
2. Converts to OpenAI function schema
3. Adds to tool catalog
4. Makes available to agents

---

### Step 4: Add Tool to Agent Config

Edit `/apps/api/src/modules/chat/orchestrator/agent_config.json`:

```json
{
  "goals": [
    {
      "goal_id": "IDENTIFY_SERVICE_CATALOG",
      "available_tools": [
        "service_list",  // ← Add new tool
        "setting_list"
      ]
    }
  ]
}
```

---

### Step 5: Test Tool

```bash
# Create session
SESSION_ID=$(curl -s -X POST http://localhost:4000/api/v1/chat/session/new \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test"}' | jq -r '.session_id')

# Send message that triggers tool
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"message\":\"What services do you offer?\"}"

# Check logs for tool call
./tools/logs-api.sh | grep "service_list"
```

**Expected log output:**
```
[MCPAdapter] 🔧 Tool call: service_list
[MCPAdapter] 📝 Executing tool: service_list with params: {}
[MCPAdapter] ✅ Tool result: {"data":[{"code":"ROOFING","name":"Roofing"},...]}
```

---

## 📚 Tool Best Practices

### 1. Always Use Session Context

**✅ Good:**
```json
// Store customer ID in session memory first
{ "function": "update_data_extraction_fields", "arguments": {
  "session_id": "abc-123",
  "updates": { "customer": { "cust_id": "cust-uuid-123" } }
}}

// Then use in subsequent tool calls
{ "function": "task_create", "arguments": {
  "customer_id": "cust-uuid-123",  // From session memory
  "title": "Roof repair"
}}
```

**❌ Avoid:**
```json
// Don't call customer_get repeatedly
{ "function": "customer_get", "arguments": { "id": "cust-uuid-123" }}
{ "function": "customer_get", "arguments": { "id": "cust-uuid-123" }}  // Duplicate!
```

---

### 2. Use Specific Tools Over Generic Ones

**✅ Good:**
```json
{ "function": "customer_search_by_phone", "arguments": {
  "phone": "6476467996"
}}
```

**❌ Avoid:**
```json
{ "function": "customer_list", "arguments": {
  "query_search": "6476467996"  // Less efficient
}}
```

---

### 3. Batch Related Operations

**✅ Good:**
```json
// Create customer and task in same goal
{ "function": "customer_create", "arguments": {...}}
{ "function": "task_create", "arguments": {...}}
```

**❌ Avoid:**
```json
// Spread across multiple goals (slower)
Goal 1: customer_create
Goal 2: task_create
```

---

### 4. Validate Data Before API Calls

**✅ Good:**
```json
// Check phone number format before customer_create
if (/^\d{10}$/.test(phone)) {
  { "function": "customer_create", "arguments": {...}}
}
```

**❌ Avoid:**
```json
// Call API with invalid data (will fail)
{ "function": "customer_create", "arguments": {
  "primary_phone": "invalid"  // ❌ Will error
}}
```

---

## 🔍 Tool Debugging

### View Available Tools

```bash
# Check MCP adapter logs
./tools/logs-api.sh | grep "MCPAdapter" | grep "tools available"

# Expected output:
# [MCPAdapter] 📦 60 tools available for goal: LOOKUP_UPDATE_CREATE_RECORDS
```

---

### Verify Tool Execution

```bash
# View tool calls
./tools/logs-api.sh | grep "Tool call:"

# Expected output:
# [MCPAdapter] 🔧 Tool call: customer_search_by_phone
# [MCPAdapter] 🔧 Tool call: task_create
# [MCPAdapter] 🔧 Tool call: person_calendar_book
```

---

### Check Tool Results

```bash
# View tool results
./tools/logs-api.sh | grep "Tool result:"

# Expected output:
# [MCPAdapter] ✅ Tool result: {"found":true,"customer":{"id":"cust-uuid-123"}}
```

---

### Debug Tool Errors

```bash
# View tool errors
./tools/logs-api.sh | grep "Tool error:"

# Expected output:
# [MCPAdapter] ❌ Tool error: customer_create - UNIQUE constraint failed: d_customer.primary_phone
```

---

## 📖 Related Documentation

- [AI Chat System](./AI_CHAT_SYSTEM.md) - Complete system documentation
- [Agent Configuration Guide](./AGENT_CONFIG_GUIDE.md) - Configure agent tool access
- [Quick Start](./QUICK_START.md) - Get started with AI chat
- [API Manifest](../../apps/mcp-server/src/api-manifest.ts) - Complete API catalog

---

**Last Updated:** 2025-11-11
**Maintained By:** PMO Platform Team
**Version:** 6.1.0
