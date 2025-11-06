# AI Chat System - Complete Architecture

**Version:** 2.1.0 | **Status:** Production | **Updated:** 2025-11-06

> **🚀 ENHANCED ARCHITECTURE AVAILABLE:** For stateful multi-agent workflows with intent graphs, conversation boundaries, and cost optimization, see the **[Multi-Agent Orchestrator](../orchestrator/README.md)**.
>
> The orchestrator provides:
> - External state management (prevents context loss)
> - Specialized agents (Critic, Evaluator, Worker)
> - Intent graph templates for reliable workflows
> - 30-85% cost reduction through model optimization
> - Auto-goodbye/hangup for off-topic conversations
>
> This document covers the direct OpenAI integration approach. Use this for simple chat scenarios. Use the orchestrator for complex, stateful workflows.

---

## 1. Semantics & Business Context

### Purpose
AI-powered customer service system providing **text chat** and **voice calling** capabilities with authenticated access to 50+ PMO API endpoints via Model Context Protocol (MCP).

### Business Value
- **24/7 Automated Service** - Handle inquiries, bookings, service requests without human intervention
- **Multi-Modal Interaction** - Text chat (GPT-4-turbo) + Voice calling (GPT-4o-realtime)
- **Full Platform Access** - AI executes authenticated operations (RBAC-enforced) across all entities
- **Conversation Memory** - AI tracks context throughout conversation, never re-asks questions
- **Strict Boundaries** - Refuses off-topic requests, focused solely on Huron Home Services

### Core Capabilities
- **Customer Profile Management** - Create, search, update incrementally (field-by-field)
- **Service Booking** - Check availability, create appointments, manage bookings
- **Task Creation** - Convert customer issues into tasks with proper categorization
- **Real-Time Data Access** - Employee schedules, service catalog, availability via MCP tools

---

## 2. Architecture & DRY Design Patterns

### System Block Diagram

```
┌─────────────────────────────────────────────────────┐
│              CLIENT (React 19)                       │
│  ChatWidget.tsx                                      │
│  ├─ Text Chat Tab                                   │
│  └─ Voice Call Button (Phone Icon)                  │
└────────────┬────────────────────────────────────────┘
             │ HTTP (text) / WebSocket (voice)
             │ Bearer Token (JWT)
             ▼
┌─────────────────────────────────────────────────────┐
│          BACKEND (Fastify API)                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ Chat Routes (routes.ts)                        │ │
│  │  POST /session/new   → createSession()         │ │
│  │  POST /message       → getAIResponse()         │ │
│  │  WS   /voice/call    → VoiceService            │ │
│  └────────────┬───────────────────────────────────┘ │
│               ▼                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ AI Services                                    │ │
│  │  openai.service.ts   → Chat completions       │ │
│  │  voice.service.ts    → Realtime API           │ │
│  └────────────┬───────────────────────────────────┘ │
│               ▼                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ MCP Adapter (mcp-adapter.service.ts)          │ │
│  │  executeMCPTool(name, args, authToken)        │ │
│  │  ├─ Tool filtering (50/126)                   │ │
│  │  └─ POST /api/mcp/execute/:toolName           │ │
│  └────────────┬───────────────────────────────────┘ │
└───────────────┼─────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────┐
│          PMO API ECOSYSTEM                           │
│  126+ Authenticated Endpoints                        │
│  ├─ Customer CRUD                                    │
│  ├─ Task Management                                  │
│  ├─ Project Operations                               │
│  └─ Employee/Booking/Service APIs                    │
└─────────────────────────────────────────────────────┘
```

### DRY Design Patterns

#### Pattern 1: Universal MCP Tool Execution
**Both text and voice use identical tool execution flow:**

```typescript
// BOTH agents call:
executeMCPTool(toolName, args, authToken)
  → POST /api/mcp/execute/:toolName
  → Returns standardized result

// No SQL, no direct DB access
// All operations via authenticated API calls
```

#### Pattern 2: Incremental Data Collection
**Customer profile building happens field-by-field:**

```typescript
// Step 1: Create minimal profile
customer_create({name, phone}) → {id}

// Step 2: Update as info arrives
customer_update({customer_id, address})
customer_update({customer_id, city, postal_code})
customer_update({customer_id, email})

// Each update: JSONB merge in d_cust table
```

#### Pattern 3: Conversation Memory via Context
**System prompts enforce memory tracking:**

```
CONVERSATION MEMORY - CRITICAL:
- TRACK ALL INFORMATION: Remember everything customer provides
- NEVER RE-ASK: If customer said "I'm John", never ask name again
- BUILD ON CONTEXT: Use previous info to move forward
- STORED INFO: After customer_update, that field is SAVED
```

**AI uses OpenAI's native context window, not database memory.**

#### Pattern 4: Schema Consistency
**All custom fields stored in JSONB metadata:**

```sql
-- f_customer_interaction DDL:
metadata jsonb DEFAULT '{}'::jsonb

-- NOT direct columns:
❌ resolution_status column
❌ first_contact_resolution column
✅ metadata->>'resolution_status'
✅ metadata->>'first_contact_resolution'
```

---

## 3. Database, API & UI/UX Mapping

### Database Layer

**Table: `f_customer_interaction` (db/41_f_interaction.ddl)**

Core schema:
```sql
CREATE TABLE app.f_customer_interaction (
  id uuid PRIMARY KEY,
  interaction_number varchar(50) UNIQUE,
  interaction_type varchar(50),          -- 'chat', 'voice_call'
  channel varchar(50),                   -- 'live_chat', 'phone'
  interaction_person_entities jsonb,     -- [{person_entity_type, person_entity_id}]
  content_text text,                     -- Conversation JSON array
  metadata jsonb,                        -- Custom fields (resolution, tokens, etc.)
  source_system varchar(50),             -- 'ai_chat_widget'
  created_ts timestamptz,
  updated_ts timestamptz
);
```

**Key JSONB fields:**
- `interaction_person_entities` - Customer/employee references
- `metadata` - Flexible storage for: `customer_name`, `customer_email`, `resolution_status`, `total_tokens`, `total_cost_cents`

### API Layer

**Routes: `/api/v1/chat/*`**

```typescript
POST /session/new
  → createSession(customer_id?, customer_email?)
  → INSERT INTO f_customer_interaction
  → Returns {session_id, interaction_number}

POST /message
  → getSession(session_id)
  → getAIResponse(conversationHistory, {useMCP: true, authToken})
  → updateSession(session_id, updatedConversation, metadata)
  → Returns {response, function_calls, booking_created}

WS /voice/call
  → VoiceService.handleConnection()
  → OpenAI Realtime API bidirectional audio
  → executeMCPTool() on function calls
```

**Function execution flow:**

```typescript
// Text chat:
routes.ts → openai.service.ts → executeFunctionCall()
  → if (useMCP && authToken) executeMCPTool()
  → else fallback to legacy function tools

// Voice chat:
voice.service.ts → handleFunctionCall()
  → if (authToken) executeMCPTool()
  → else legacy function tools
```

### UI/UX Layer

**Component: `ChatWidget.tsx`**

```typescript
// State management:
const {user} = useAuth();
const token = localStorage.getItem('auth_token');

// Text chat flow:
1. startChatSession() → POST /session/new (with token)
2. handleSendMessage() → POST /message (with token)
3. Display response with typing animation

// Voice chat flow:
1. startVoiceCall() → WebSocket connection with token
2. Capture audio → send PCM16 chunks
3. Receive audio → play via AudioContext
4. Display transcript in real-time
```

---

## 4. Entity Relationships

**Relevant DDL:** `db/41_f_interaction.ddl`, `db/14_d_cust.ddl`

### Relationship Model

```
f_customer_interaction (Fact Table)
├─ interaction_person_entities (JSONB array)
│  └─ [{person_entity_type: 'customer', person_entity_id: <uuid>}]
│     ↓
│     d_cust (Customer Dimension)
│     ├─ id (uuid PRIMARY KEY)
│     ├─ name, primary_phone, primary_email
│     └─ primary_address, city, province, postal_code
│
└─ metadata (JSONB)
   ├─ customer_name
   ├─ customer_email
   ├─ resolution_status
   ├─ total_tokens
   └─ total_cost_cents
```

**No foreign keys** - All relationships via JSONB arrays for flexibility.

### Customer Update Pattern

```typescript
// Dynamic field updates (functions.service.ts):
updateCustomer({
  customer_id: string,
  [key: string]: any  // ANY field accepted
})

// Maps to UPDATE d_cust:
SET
  name = $name,
  primary_phone = $phone,
  primary_address = $address,
  city = $city,
  postal_code = $postal_code,
  ...any_field = $value,
  updated_ts = NOW()
WHERE id = $customer_id
```

---

## 5. Central Configuration & Middleware

### System Prompts

**Both text and voice agents use identical boundary rules:**

```typescript
// openai.service.ts + voice.service.ts:

STRICT BOUNDARIES:
1. ONLY Huron Home Services (HVAC, Plumbing, Electrical, Landscaping, Contracting)
2. Refuse off-topic: "I'm specifically here for Huron Home Services..."
3. ALWAYS use API tools - never guess
4. Brief responses (2-3 sentences)
5. ONE question at a time
6. NEVER re-ask provided information

CONVERSATION MEMORY:
- Track all info: name, phone, address, issue, service type, date
- After customer_create/update, that info is SAVED
- Reference memory: "Got it, let me update your address" (not "What's your address?")

INCREMENTAL DATA COLLECTION:
1. Get name + phone FIRST
2. search_customer (by phone)
3. If not found → customer_create ({name, phone})
4. As customer provides more → customer_update ({customer_id, field: value})
5. Use saved customer_id for tasks/bookings
```

### MCP Adapter Configuration

```typescript
// mcp-adapter.service.ts:

export function getCustomerServiceTools(): ChatCompletionTool[] {
  return getMCPTools({
    includeCategories: [
      'Customer', 'Task', 'Project', 'Employee',
      'Booking', 'Service', 'Settings'
    ],
    excludeEndpoints: [
      'auth_login', 'customer_delete', 'task_delete', ...
    ],
    maxTools: 50  // Limit to avoid token overflow
  });
}

export async function executeMCPTool(
  toolName: string,
  args: any,
  authToken: string
): Promise<any> {
  const url = `${API_BASE_URL}/api/mcp/execute/${toolName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  return response.json();
}
```

### Auth Token Flow

```typescript
// Frontend → Backend:
ChatWidget.tsx:
  const token = localStorage.getItem('auth_token');
  headers: {'Authorization': `Bearer ${token}`}

// Backend extraction:
routes.ts:
  const token = request.headers.authorization?.replace('Bearer ', '');

// Token validation:
- If token present → useMCP: true, 50+ tools available
- If no token → falls back to 3 legacy tools (limited)
```

---

## 6. User Interaction Flow Examples

### Example 1: Text Chat - Service Booking

```
User: "Hi, I need my furnace fixed"
  ↓ POST /message
  ↓ AI analyzes: needs customer info
AI: "Hi! I'm the assistant for Huron Home Services. Can I get your name and phone?"

User: "I'm Sarah, 647-555-1234"
  ↓ AI calls: customer_list({phone: "647-555-1234"})
  ↓ Result: null (not found)
  ↓ AI calls: customer_create({name: "Sarah", phone: "647-555-1234"})
  ↓ Result: {id: "abc-123", name: "Sarah", ...}
AI: "Perfect Sarah! You're in good hands. What's your address?"

User: "123 Main St, Toronto, M5A 1A1"
  ↓ AI calls: customer_update({customer_id: "abc-123", address: "123 Main St", city: "Toronto", postal_code: "M5A 1A1"})
  ↓ Result: {id: "abc-123", primary_address: "123 Main St", ...}
AI: "Got it. That sounds frustrating. Let me check HVAC availability for 123 Main St..."
  ↓ AI calls: get_employee_availability({service_category: "HVAC", requested_date: "2025-11-07"})
  ↓ Result: [{employee_name: "John", available_slots: ["09:00", "14:00"]}]
AI: "We have HVAC technicians available tomorrow at 9 AM or 2 PM. Which works better?"
```

**Key behaviors:**
- ✅ Never asked "What's your name?" twice
- ✅ Stored address/city/postal_code in single update
- ✅ Used saved customer_id for availability check
- ✅ Empathy: "That sounds frustrating. You're in good hands."

### Example 2: Voice Call - Off-Topic Handling

```
User (voice): "What's the weather tomorrow?"
  ↓ AI detects off-topic
AI (voice): "I'm specifically here for Huron Home Services bookings and support. Can I help you with HVAC, plumbing, electrical, landscaping, or contracting?"

User: "Oh okay, I need my toilet fixed"
  ↓ AI switches to service mode
AI: "That sounds concerning. You're in good hands. Can I get your name and phone number?"
```

**Boundary enforcement:**
- ❌ Never answers weather, jokes, general knowledge
- ✅ Standard refusal response
- ✅ Redirects to service offerings

---

## 7. Critical Considerations When Building

### For Developers Extending This System

#### ⚠️ **Token Required for Full Functionality**
```typescript
// Without authToken:
- Falls back to 3 legacy tools (limited)
- Cannot create_customer, create_task, check availability
- Logs: "⚠️ Falling back to legacy tools (no auth token)"

// With authToken:
- Access to 50 MCP tools
- Full CRUD on customers, tasks, projects, bookings
- Logs: "📡 Executing MCP tool via PMO API: customer_create"
```

#### ⚠️ **Schema Consistency**
```typescript
// f_customer_interaction has NO direct columns for:
❌ customer_id, customer_name, resolution_status, first_contact_resolution

// Use JSONB fields:
✅ interaction_person_entities (array of entity references)
✅ metadata (flexible storage for custom fields)

// Extract customer_id:
const customerEntity = row.interaction_person_entities
  .find(e => e.person_entity_type === 'customer');
const customerId = customerEntity?.person_entity_id;
```

#### ⚠️ **Conversation Memory is Context-Based**
```typescript
// AI memory = OpenAI context window (NOT database)
// To maintain memory:
- Pass FULL conversationHistory array to getAIResponse()
- System prompt instructs AI to track info
- For 100+ message conversations, implement summarization
```

#### ⚠️ **Dynamic Field Updates**
```typescript
// customer_update accepts ANY field:
customer_update({
  customer_id: "abc",
  primary_address: "123 Main St",    // Standard field
  custom_field: "value"              // Dynamic field
})

// All fields optional except customer_id
// Backend handles field mapping (primary_ prefix)
```

#### ⚠️ **MCP Tool Format Differences**
```typescript
// Text Chat: ChatCompletionTool format
{
  type: 'function',
  function: {name, description, parameters}
}

// Voice Chat: Realtime API format
{
  type: 'function',
  name, description, parameters
}

// Use convertMCPToolsToRealtimeFormat() for voice
```

#### ⚠️ **Race Condition Handling**
```typescript
// createSession retries on duplicate interaction_number:
- Max 3 attempts
- Exponential backoff (50ms, 100ms, 150ms)
- Throws after exhausting retries
```

#### ⚠️ **Tool Call Limit**
```typescript
// OpenAI token limits:
- 50 tools ≈ 8-10k tokens (safe)
- 126 tools ≈ 20k+ tokens (exceeds limit)

// Filter to customer-service-relevant tools only:
getCustomerServiceTools() // Returns 50/126 tools
```

---

## Quick Reference

**Files Modified (v2.1.0):**
```
apps/api/src/modules/chat/
├── openai.service.ts       ← System prompt + MCP logging
├── voice.service.ts        ← Memory tracking + boundaries
├── functions.service.ts    ← Dynamic customer_update
├── conversation.service.ts ← Schema consistency (metadata)
└── routes.ts               ← Token logging

docs/ai_chat/
└── AI_CHAT_SYSTEM.md      ← This document
```

**Key APIs:**
- `POST /api/v1/chat/session/new` - Create session
- `POST /api/v1/chat/message` - Send message (text)
- `WS /api/v1/chat/voice/call` - Voice call (WebSocket)
- `POST /api/mcp/execute/:toolName` - Execute MCP tool

**Testing:**
```bash
# Check logs for MCP tool usage:
./tools/logs-api.sh | grep "📡 Executing MCP tool"

# Test text chat:
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"session_id":"...","message":"I need HVAC service"}'
```

---

**Status:** ✅ Production Ready
**Version:** 2.1.0
**Last Updated:** 2025-11-06
