# MCP (Model Context Protocol) Architecture

> **Last Updated:** 2025-11-09
> **Version:** 3.0.0
> **Author:** Advanced Software Engineer & Solutions Architect
> **Audience:** Technical Staff Architects & Engineers

---

## Table of Contents

1. [Semantics & Business Context](#semantics--business-context)
2. [Tooling & Framework Architecture](#tooling--framework-architecture)
3. [Architecture & Design Patterns](#architecture--design-patterns)
4. [Database, API & UI/UX Mapping](#database-api--uiux-mapping)
5. [Central Configuration & Middleware](#central-configuration--middleware)
6. [User Interaction Flow Examples](#user-interaction-flow-examples)
7. [Critical Considerations When Building](#critical-considerations-when-building)

---

## 1. Semantics & Business Context

### What is MCP in This System?

**MCP (Model Context Protocol)** in the PMO platform is NOT the Anthropic MCP specification. Instead, it's an internal **API abstraction layer** that converts PMO internal APIs into OpenAI-compatible function tools, enabling LLM agents to execute business operations via function calling.

### Business Purpose

The AI chat system needs to perform real business operations:
- Create customer profiles with fine-grained address data
- Search existing customers in the database
- Create tasks with rich descriptions (customer data + conversation history)
- Book calendar appointments with linked tasks
- Manage entity relationships (projects, tasks, employees)

**MCP bridges the gap between:**
- **LLM agents** (GPT-4o mini, OpenAI function calling)
- **PMO internal APIs** (Fastify routes, PostgreSQL database)

### Key Capabilities

1. **Dynamic API Discovery** - API manifest auto-generates OpenAI function tools
2. **Auto-Enrichment** - Middleware enriches MCP calls with session context
3. **Type Safety** - TypeScript interfaces ensure correct parameter mapping
4. **Authentication Passthrough** - JWT tokens flow from chat session to API calls
5. **Error Handling** - Graceful failures with retry logic

---

## 2. Tooling & Framework Architecture

### Core Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **AI Model** | GPT-4o mini | LLM for agent reasoning + function calling |
| **MCP Adapter** | Custom TypeScript service | Converts API manifest → OpenAI tools |
| **API Manifest** | JSON schema | Registry of all PMO API endpoints |
| **API Executor** | Axios HTTP client | Executes enriched API calls |
| **Auth** | JWT Bearer tokens | Session-based authentication |
| **Storage** | LowDB (JSON file) | Session memory persistence |

### MCP Components

```
┌─────────────────────────────────────────────────────────────┐
│                   AI CHAT SYSTEM                            │
├─────────────────────────────────────────────────────────────┤
│  Conversational   │  Data Extraction  │  Worker MCP        │
│     Agent         │      Agent         │     Agent          │
│  (talk to user)   │  (extract data)    │  (execute tools)   │
└──────┬────────────┴─────────┬──────────┴──────┬─────────────┘
       │                      │                  │
       │          ┌───────────▼───────────┐      │
       │          │  Session Memory Data  │      │
       │          │  (LowDB - context,    │      │
       │          │   conversation, data) │      │
       │          └───────────┬───────────┘      │
       │                      │                  │
       └──────────────────────┴──────────────────▼
                              │
                   ┌──────────▼──────────┐
                   │   MCP ADAPTER       │
                   │  - Load manifest    │
                   │  - Generate tools   │
                   │  - Enrich args      │
                   │  - Execute API      │
                   └──────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
        │ Customer  │  │   Task    │  │ Calendar  │
        │    API    │  │    API    │  │    API    │
        └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
              │               │               │
              └───────────────▼───────────────┘
                              │
                     ┌────────▼─────────┐
                     │   PostgreSQL     │
                     │   (52 tables)    │
                     └──────────────────┘
```

---

## 3. Architecture & Design Patterns

### A. MCP Adapter Pattern

**Purpose:** Convert PMO APIs into OpenAI function tools dynamically

**File:** `apps/api/src/modules/chat/mcp-adapter.service.ts`

**Architecture:**

```
┌────────────────────────────────────────────────────────────┐
│                    API MANIFEST                             │
│  [{ name: 'customer_create', path: '/api/v1/cust', ... }]  │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
           ┌──────────────────────────────────┐
           │  endpointToOpenAITool()          │
           │  - Extract parameters            │
           │  - Generate JSON schema          │
           │  - Create function description   │
           └──────────────────┬───────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  OpenAI Function     │
                   │  Tool Definition     │
                   │  {                   │
                   │    type: 'function',│
                   │    function: {...}   │
                   │  }                   │
                   └──────────┬───────────┘
                              │
                              ▼
                     ┌────────────────┐
                     │  LLM Agent     │
                     │  (can call)    │
                     └────────────────┘
```

**Key Methods:**

1. **getMCPTools(options?)** - Returns filtered OpenAI tools
2. **executeMCPTool(name, args, token)** - Executes API call
3. **getCustomerServiceTools()** - Returns curated tool set for chat

### B. Auto-Enrichment Pattern

**Purpose:** Inject session context into MCP tool calls automatically

**File:** `apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.ts`

**Flow Diagram:**

```
┌──────────────────────────────────────────────────────────────┐
│                  LLM DECIDES TO USE TOOL                      │
│  tool_call: { name: 'task_create', args: { name: 'Fix...' }} │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │  enrichMCPToolArguments()          │
         │  ┌──────────────────────────────┐  │
         │  │ IF tool === 'task_create'    │  │
         │  │   ├─ Read session context    │  │
         │  │   ├─ Extract customer data   │  │
         │  │   ├─ Get conversation history│  │
         │  │   └─ Build rich description  │  │
         │  └──────────────────────────────┘  │
         │  ┌──────────────────────────────┐  │
         │  │ IF tool === 'customer_create'│  │
         │  │   ├─ Map address_street →    │  │
         │  │   │   body_primary_address   │  │
         │  │   ├─ Map address_city →      │  │
         │  │   │   body_city              │  │
         │  │   └─ Map all fine-grained    │  │
         │  │     address fields            │  │
         │  └──────────────────────────────┘  │
         │  ┌──────────────────────────────┐  │
         │  │ IF tool === 'calendar_book'  │  │
         │  │   ├─ Add task reference      │  │
         │  │   ├─ Build attendees list    │  │
         │  │   │   (customer + employee)  │  │
         │  │   └─ Enrich metadata         │  │
         │  └──────────────────────────────┘  │
         └─────────────────┬──────────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │  ENRICHED ARGS               │
            │  {                           │
            │    body_name: "Fix leak",    │
            │    body_descr: "## Customer  │
            │      Info\n- Name: John..."  │
            │  }                           │
            └──────────────┬───────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │ executeMCPTool │
                  │  (API call)    │
                  └────────────────┘
```

**Enrichment Cases:**

| Tool Name | Enrichment Logic | Output |
|-----------|------------------|--------|
| `task_create` | Append customer data + conversation history | `body_descr` with markdown sections |
| `customer_create` | Map fine-grained address to API fields | `body_primary_address`, `body_city`, `body_province`, etc. |
| `customer_update` | Incremental address field mapping | Only update new fields |
| `person_calendar_book` | Add task reference + attendees metadata | `body_metadata` with attendees array |

### C. Session Memory Integration Pattern

**Purpose:** Persist extracted data and conversation state

**File:** `apps/api/src/modules/chat/orchestrator/mcp/session-memory-data-mcp.tools.ts`

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│          SESSION MEMORY DATA SERVICE                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  LowDB JSON File Storage                          │  │
│  │  /tmp/lowdb/sessions/{sessionId}.json             │  │
│  │  {                                                 │  │
│  │    sessionId: "uuid",                             │  │
│  │    context: {                                      │  │
│  │      data_extraction_fields: {                    │  │
│  │        customer: {                                 │  │
│  │          name: "John Doe",                        │  │
│  │          phone: "555-1234",                       │  │
│  │          address_street: "353531 Edmonton Ave",   │  │
│  │          address_city: "Palo Alto",               │  │
│  │          address_state: "CA",                     │  │
│  │          address_zipcode: "94301"                 │  │
│  │        },                                          │  │
│  │        service: { primary_request: "Fix leak" },  │  │
│  │        operations: { task_id: "uuid", ... }       │  │
│  │      },                                            │  │
│  │      summary_of_conversation: [...],              │  │
│  │      node_traversed: [...]                        │  │
│  │    }                                               │  │
│  │  }                                                 │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
       ▼                  ▼                  ▼
  ┌─────────┐      ┌────────────┐     ┌──────────┐
  │ Data    │      │ Worker     │     │ Context  │
  │ Extract │      │ MCP Agent  │     │ Init     │
  │ Agent   │      │ (reads)    │     │ Service  │
  │ (writes)│      └────────────┘     │ (init)   │
  └─────────┘                         └──────────┘
```

**Key MCP Tools:**

1. **get_session_memory_data** - Retrieve full session
2. **update_data_extraction_fields** - Write extracted customer data
3. **update_session_memory_data** - Update context fields
4. **appendConversationToMemoryData** - Add conversation exchange

---

## 4. Database, API & UI/UX Mapping

### API Manifest → Database Mapping

**Customer Profile Flow:**

```
┌────────────────────────────────────────────────────────┐
│  AI AGENT EXTRACTS DATA                                │
│  customer: {                                           │
│    name: "John Doe",                                   │
│    phone: "555-1234",                                  │
│    address_street: "353531 Edmonton Ave",              │
│    address_city: "Palo Alto",                          │
│    address_state: "CA",                                │
│    address_zipcode: "94301"                            │
│  }                                                      │
└─────────────────┬──────────────────────────────────────┘
                  │
                  ▼
      ┌───────────────────────────┐
      │  MCP Tool: customer_create│
      │  (auto-enriched)          │
      └───────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │  API Call          │
         │  POST /api/v1/cust │
         │  {                 │
         │    body_name,      │
         │    body_primary_   │
         │      phone,        │
         │    body_primary_   │
         │      address,      │
         │    body_city,      │
         │    body_province,  │
         │    body_postal_    │
         │      code          │
         │  }                 │
         └────────┬───────────┘
                  │
                  ▼
     ┌─────────────────────────────┐
     │  Database: app.customer   │
     │  INSERT INTO app.customer │
     │  (                          │
     │    name,                    │
     │    primary_phone,           │
     │    primary_address,         │
     │    city,                    │
     │    province,                │
     │    postal_code,             │
     │    country                  │
     │  )                          │
     └─────────────┬───────────────┘
                   │
                   ▼
          ┌────────────────────┐
          │  RETURNS customer  │
          │  { id: "uuid",     │
          │    name: "...",    │
          │    ... }           │
          └────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Store in Session    │
        │  context:            │
        │    customer.id=uuid  │
        └──────────────────────┘
```

### Task Creation with Auto-Enrichment

```
┌────────────────────────────────────────────────────┐
│  LLM: "Create task to fix plumbing leak"          │
└───────────────────┬────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  MCP: task_create    │
         │  args: {             │
         │    body_name: "Fix   │
         │      plumbing leak"  │
         │  }                   │
         └──────────┬───────────┘
                    │
                    ▼
    ┌───────────────────────────────────┐
    │  enrichMCPToolArguments()         │
    │  → Read session context           │
    │  → Build rich description:        │
    │    "## Customer Information       │
    │     - Name: John Doe              │
    │     - Phone: 555-1234             │
    │     - Address: 353531 Edmonton... │
    │                                   │
    │    ## Service Request             │
    │     - Request: Fix plumbing leak  │
    │                                   │
    │    ## Conversation History        │
    │     Exchange 1:                   │
    │     Customer: My sink is leaking  │
    │     Agent: I can help with that..." │
    └───────────────┬───────────────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │  POST /api/v1/task  │
          │  {                  │
          │    body_name,       │
          │    body_descr       │
          │      (enriched!)    │
          │  }                  │
          └──────────┬──────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  Database: app.task   │
        │  INSERT with rich descr │
        └─────────────┬───────────┘
                      │
                      ▼
             ┌────────────────┐
             │  Employee sees │
             │  full context  │
             │  in task!      │
             └────────────────┘
```

---

## 5. Central Configuration & Middleware

### Agent Configuration (agent_config.json)

**Location:** `apps/api/src/modules/chat/orchestrator/agent_config.json`

**Structure:**

```json
{
  "version": "3.0.0",
  "goals": [
    {
      "goal_id": "GATHER_REQUIREMENTS",
      "available_tools": ["customer_get", "customer_create"],
      "success_criteria": {
        "mandatory_fields": ["customer.phone", "customer.name", "customer.address"]
      }
    }
  ],
  "agent_profiles": {
    "mcp_agent": {
      "capabilities": ["tool_selection", "api_execution", "customer_profile_management"],
      "tool_selection_strategy": {
        "customer_get": "Use when customer.phone or customer.email exists but customer.id is empty",
        "customer_create": "Use after customer_get returns no results. Create with fine-grained address",
        "customer_update": "Use when customer.id exists and new data available",
        "task_create": "Auto-enriched with customer data + conversation history",
        "person_calendar_book": "Auto-enriched with task reference + attendees"
      },
      "customer_profile_workflow": {
        "step_1": "Search existing customer",
        "step_2": "If found: Update via customer_update",
        "step_3": "If not found: Create via customer_create",
        "step_4": "Store customer.id in context"
      }
    }
  }
}
```

**Purpose:** Declarative configuration for agent behavior, tool selection, and workflows

### MCP Adapter Middleware

**Auto-Generation Logic:**

```typescript
// apps/api/src/modules/chat/mcp-adapter.service.ts

// 1. Load API Manifest
import { API_MANIFEST } from '../mcp-server/src/api-manifest.js';

// 2. Convert to OpenAI Tools
function endpointToOpenAITool(endpoint: APIEndpoint): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: endpoint.name,
      description: endpoint.description,
      parameters: {
        type: 'object',
        properties: { /* extracted from endpoint.parameters */ },
        required: [ /* path parameters */ ]
      }
    }
  };
}

// 3. Filter Tools by Category
function getMCPTools(options?: {
  categories?: string[];
  includeEndpoints?: string[];
  excludeEndpoints?: string[];
  maxTools?: number;
}): ChatCompletionTool[]

// 4. Execute with Auth + Enrichment
async function executeMCPTool(
  toolName: string,
  args: Record<string, any>,
  authToken: string
): Promise<any>
```

### API Manifest Structure

**Location:** `apps/mcp-server/src/api-manifest.js`

**Example Entry:**

```javascript
{
  name: 'customer_create',
  method: 'POST',
  path: '/api/v1/cust',
  description: 'Create new customer. Only name is required, all other fields optional',
  requiresAuth: true,
  category: 'Customer',
  parameters: {
    body: {
      name: 'Customer full name (REQUIRED - minimum info needed)',
      primary_phone: 'Phone number (highly recommended)',
      primary_email: 'Email address (optional)',
      primary_address: 'Street address (optional)',
      city: 'City (optional)',
      province: 'Province (optional, defaults to ON)',
      postal_code: 'Postal code (optional)'
    }
  }
}
```

**Categories:** Customer, Task, Project, Employee, Calendar, Settings, Linkage, etc.

---

## 6. User Interaction Flow Examples

### Example 1: Customer Reports Plumbing Issue

**User Journey:**

```
┌─────────────────────────────────────────────────────────┐
│  Customer: "My sink is leaking, need help ASAP"        │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │  GOAL: UNDERSTAND_REQUEST │
        │  - Conversational Agent   │
        │  - Data Extraction Agent  │
        │    (parallel)             │
        │  → Extracts: service.     │
        │    primary_request =      │
        │    "plumbing leak"        │
        └───────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────┐
    │  Agent: "I can help! What's your name    │
    │   and phone number?"                      │
    └───────────┬───────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────┐
│  Customer: "John Doe, 555-1234, my address is         │
│   353531 Edmonton Avenue, Palo Alto, California"      │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────┐
        │  GOAL: GATHER_REQUIREMENTS   │
        │  - Data Extraction Agent     │
        │    Extracts:                 │
        │    customer.name = "John Doe"│
        │    customer.phone = "555..."  │
        │    customer.address_street = │
        │      "353531 Edmonton Ave"   │
        │    customer.address_city =   │
        │      "Palo Alto"             │
        │    customer.address_state =  │
        │      "California"            │
        │                              │
        │  - Worker MCP Agent          │
        │    1. Calls customer_get     │
        │       (search by phone)      │
        │    2. Not found              │
        │    3. Calls customer_create  │
        │       (auto-enriched with    │
        │        fine-grained address) │
        │    4. Stores customer.id     │
        └──────────────┬───────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │  GOAL: DESIGN_SOLUTION     │
          │  - Planner Agent creates   │
          │    solution plan           │
          │  - Agent asks for consent  │
          └──────────────┬─────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │  GOAL: EXECUTE_SOLUTION        │
        │  - Worker MCP Agent            │
        │    1. Calls task_create        │
        │       (auto-enriched with      │
        │        customer info +         │
        │        conversation history)   │
        │    2. Stores task.id           │
        │    3. Calls person_calendar_   │
        │       book                     │
        │       (auto-enriched with      │
        │        task reference +        │
        │        attendees: John's email,│
        │        employee email)         │
        └────────────────┬───────────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │  GOAL: CONFIRM        │
             │    RESOLUTION         │
             │  - Agent confirms     │
             │    appointment        │
             │  - Hangs up           │
             └───────────────────────┘
```

**Database State After Call:**

```
app.customer:
  id: abc-123
  name: "John Doe"
  primary_phone: "555-1234"
  primary_address: "353531 Edmonton Avenue"
  city: "Palo Alto"
  province: "California"
  postal_code: NULL

app.task:
  id: def-456
  name: "Fix plumbing leak"
  descr: "## Customer Information
          - Name: John Doe
          - Phone: 555-1234
          - Address: 353531 Edmonton Avenue, Palo Alto, CA

          ## Service Request
          - Request: Fix plumbing leak

          ## Conversation History
          Exchange 1:
          Customer: My sink is leaking, need help ASAP
          Agent: I can help! What's your name and phone number?
          ..."

app.d_entity_person_calendar:
  id: ghi-789
  title: "Plumbing Service"
  instructions: "Task ID: def-456
                Task: Fix plumbing leak
                Service: Plumbing repair
                Customer: John Doe
                Phone: 555-1234"
  metadata: {
    "attendees": [
      { "name": "John Doe", "email": null, "phone": "555-1234", "type": "customer" },
      { "name": "Employee Name", "email": "emp@example.com", "type": "employee" }
    ],
    "task_id": "def-456",
    "service_type": "plumbing_service"
  }
```

---

## 7. Critical Considerations When Building

### A. For Backend Engineers

#### MCP Tool Registration

**DO:**
- ✅ Add new endpoints to `apps/mcp-server/src/api-manifest.js`
- ✅ Document parameters clearly (mark REQUIRED vs optional)
- ✅ Use descriptive function names (verb_noun pattern: `customer_create`, `task_update`)
- ✅ Test tools via `getMCPTools()` before deploying

**DON'T:**
- ❌ Create tools without adding to manifest
- ❌ Use vague descriptions - LLM needs precise context
- ❌ Hardcode parameters - use dynamic body fields (`body_*`)

#### Auto-Enrichment Extension

**When to Add Enrichment:**
- New MCP tool that needs session context
- Tool requires complex data transformation
- Tool creates entity that should reference other entities

**Pattern:**
```typescript
// apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.ts

private enrichMCPToolArguments(toolName, args, state) {
  if (toolName === 'your_new_tool') {
    const extracted = state.context.data_extraction_fields || {};

    // Map extracted data to API fields
    if (extracted.customer?.email && !args.body_email) {
      args.body_email = extracted.customer.email;
    }

    // Build rich descriptions
    let description = args.body_descr || '';
    description += `\n\n## Additional Context\n${extracted.service.primary_request}`;
    args.body_descr = description;
  }
  return args;
}
```

### B. For Agent Configuration

#### Tool Selection Strategy

**Update `agent_config.json` when:**
- Adding new MCP tools
- Changing tool behavior (parameters, enrichment)
- Modifying goal workflows

**Example:**
```json
{
  "tool_selection_strategy": {
    "your_new_tool": "Clear description of WHEN to use this tool and WHAT parameters it needs"
  }
}
```

### C. For Data Integrity

#### Address Field Mapping

**Critical:** Fine-grained address fields must map correctly:

```
Extracted Data          →  API Field          →  Database Column
─────────────────────────────────────────────────────────────────
customer.address_street →  body_primary_address →  primary_address
customer.address_city   →  body_city            →  city
customer.address_state  →  body_province        →  province
customer.address_zipcode →  body_postal_code    →  postal_code
customer.address_country →  body_country        →  country
```

**Validation:**
- Ensure enrichment logic in `WorkerMCPAgent.enrichMCPToolArguments()` matches API parameter names
- Test with real address data from multiple countries
- Handle missing fields gracefully (optional vs required)

### D. For Testing

#### End-to-End MCP Flow Testing

**Test Scenarios:**
1. **Customer Profile Creation**
   - New customer with full address
   - Existing customer update
   - Missing optional fields

2. **Task Creation**
   - Verify enriched description contains customer data
   - Verify conversation history is appended
   - Verify markdown formatting

3. **Calendar Booking**
   - Verify task reference in metadata
   - Verify attendees list populated
   - Verify customer + employee emails present

**Test Tools:**
```bash
# Check MCP tool generation
curl http://localhost:4000/api/v1/chat/mcp-tools

# Test specific tool execution
curl -X POST http://localhost:4000/api/v1/cust \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test","primary_phone":"555-9999"}'
```

### E. Performance Considerations

#### LLM Token Usage

**Context Size Management:**
- API manifest generates 60+ tools → Large prompt
- Filter tools by category for specific goals
- Use `maxTools` parameter to limit exposure

```typescript
// Good: Limit tools for customer service chat
const tools = getMCPTools({
  categories: ['Customer', 'Task', 'Calendar'],
  maxTools: 20
});

// Bad: Expose all 100+ tools
const tools = getMCPTools(); // Too many!
```

#### Session Memory Size

**LowDB File Growth:**
- Each conversation exchange appends to session file
- Implement cleanup for completed sessions
- Monitor `/tmp/lowdb/sessions/` directory size

---

## Summary

**MCP in PMO Platform:**
- **NOT** Anthropic MCP - Internal API abstraction layer
- **Converts** 60+ PMO APIs → OpenAI function tools
- **Enables** LLM agents to execute business operations
- **Auto-enriches** tool calls with session context
- **Persists** customer profiles with fine-grained address
- **Links** tasks, calendar events, customers automatically

**Key Files:**
- `apps/mcp-server/src/api-manifest.js` - Tool registry
- `apps/api/src/modules/chat/mcp-adapter.service.ts` - Tool converter + executor
- `apps/api/src/modules/chat/orchestrator/agents/worker-mcp-agent.service.ts` - Auto-enrichment logic
- `apps/api/src/modules/chat/orchestrator/agent_config.json` - Agent behavior configuration

**Design Principles:**
1. **Dynamic Tool Generation** - No hardcoding tools
2. **Auto-Enrichment** - Inject context automatically
3. **Type Safety** - TypeScript interfaces enforce correctness
4. **Declarative Configuration** - JSON-driven agent behavior
5. **Separation of Concerns** - MCP layer isolated from agent logic

---

**End of Document**
