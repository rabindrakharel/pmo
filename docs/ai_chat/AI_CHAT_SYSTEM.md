# AI Chat System - Complete Architecture

**Version:** 2.0.0 | **Status:** Production Ready | **Updated:** 2025-11-05

---

## 1. Semantics & Business Context

### Purpose
AI-powered customer service system with **text** and **voice** capabilities, enabling customers to interact naturally with an AI agent that has authenticated access to the complete PMO API ecosystem (126+ endpoints) via Model Context Protocol (MCP).

### Business Value
- **24/7 Automated Service**: Handle inquiries, bookings, and service requests without human intervention
- **Multi-Modal Interaction**: Text chat and voice calling for maximum accessibility
- **Full Platform Access**: AI accesses projects, tasks, employees, bookings, services, and all business entities
- **Authenticated Operations**: All AI actions execute under user context with RBAC enforcement
- **Complete Audit Trail**: All conversations stored in `f_customer_interaction` for compliance and training

### Core Capabilities
1. **Text Chat**: GPT-4-turbo with function calling → 50 MCP tools
2. **Voice Chat**: GPT-4o-realtime with audio streaming → 50 MCP tools
3. **Booking Creation**: Create service appointments via natural conversation
4. **Real-Time Availability**: Check employee schedules and available time slots
5. **Session Management**: Database-backed conversation history with race condition handling

---

## 2. Architecture & DRY Design Patterns

### System Block Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  ┌─────────────┐              ┌─────────────────┐       │
│  │ Text Chat   │──HTTP/WS────│  Voice Call     │       │
│  │ (Widget)    │              │  (WebRTC)       │       │
│  └─────────────┘              └─────────────────┘       │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────────────────────────────────────────┐
│                BACKEND (Fastify API)                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Chat Routes                                       │  │
│  │  POST /session/new  │  POST /message               │  │
│  │  WS   /voice/call   │  GET  /analytics             │  │
│  └─────────┬────────────────────┬─────────────────────┘  │
│            │                    │                         │
│            ▼                    ▼                         │
│  ┌──────────────────┐  ┌──────────────────────┐         │
│  │ OpenAI Service   │  │ Voice Service        │         │
│  │ (GPT-4-turbo)    │  │ (GPT-4o-realtime)    │         │
│  │ - Chat API       │  │ - Audio streaming    │         │
│  │ - Function calls │  │ - PCM16 @ 24kHz      │         │
│  └────────┬─────────┘  └────────┬─────────────┘         │
│           └──────────┬───────────┘                       │
│                      ▼                                    │
│         ┌──────────────────────────┐                     │
│         │   MCP Adapter            │                     │
│         │   - Tool converter       │                     │
│         │   - API executor         │                     │
│         │   - JWT auth             │                     │
│         └──────────┬───────────────┘                     │
│                    │                                      │
│                    ▼                                      │
│         ┌──────────────────────────┐                     │
│         │ API Manifest (126 tools) │                     │
│         │ Filtered → 50 tools      │                     │
│         │ for customer service     │                     │
│         └──────────┬───────────────┘                     │
│                    │                                      │
│                    ▼                                      │
│         ┌──────────────────────────┐                     │
│         │ Authenticated API Calls  │                     │
│         │ (axios + JWT token)      │                     │
│         └──────────┬───────────────┘                     │
└────────────────────┼──────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │   PostgreSQL         │
          │ - f_customer_        │
          │   interaction        │
          │ - d_booking          │
          │ - d_service          │
          │ - d_employee         │
          └──────────────────────┘
```

### DRY Patterns

#### 1. Single MCP Adapter for Both Chat Types
**File:** `apps/api/src/modules/chat/mcp-adapter.service.ts`

```typescript
// Universal tool provider
getMCPTools({ categories, excludeEndpoints, maxTools })
getCustomerServiceTools()  // Returns 50 relevant tools
executeMCPTool(toolName, args, authToken)  // Execute with auth
endpointToOpenAITool(endpoint)  // Convert API → OpenAI format
```

**Benefit:** Text and voice chat share identical tool definitions and execution logic.

#### 2. Format Converter Pattern
```typescript
// Text Chat (Chat Completions API)
{ type: 'function', function: { name, description, parameters } }

// Voice Chat (Realtime API)
{ name, description, parameters }

// Converter
convertMCPToolsToRealtimeFormat(mcpTools) {
  return mcpTools.map(tool => tool.function)
}
```

#### 3. Retry with Exponential Backoff
**Purpose:** Handle race conditions when multiple sessions start simultaneously.

```typescript
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    const interactionNumber = await generateInteractionNumber();
    await createSession({ interactionNumber, ... });
    return { success: true };
  } catch (error) {
    if (error.code === '23505') {  // Duplicate key
      await sleep(50 * (attempt + 1));
      continue;
    }
    throw error;
  }
}
```

### User Interaction Journey

#### Text Chat Flow
```
1. User clicks chat icon
   ↓
2. POST /session/new → Creates DB session
   ↓
3. User types message
   ↓
4. POST /message → OpenAI GPT-4-turbo
   ↓
5. AI decides which MCP tools to call
   ↓
6. Execute tools via authenticated API
   ↓
7. AI responds with natural language
   ↓
8. Booking created in d_booking table
   ↓
9. Confirmation shown in chat
```

#### Voice Call Flow
```
1. User clicks phone button
   ↓
2. WebSocket /voice/call established
   ↓
3. Microphone captures audio (WebRTC)
   ↓
4. Audio → PCM16 @ 24kHz → base64
   ↓
5. Stream to OpenAI Realtime API
   ↓
6. AI processes audio + calls MCP tools
   ↓
7. Audio response streamed back
   ↓
8. PCM16 → AudioBuffer → Speakers
   ↓
9. Transcript displayed for accessibility
```

---

## 3. Database, API & UI/UX Mapping

### Database Schema

**Table:** `app.f_customer_interaction`

```sql
CREATE TABLE app.f_customer_interaction (
  id uuid PRIMARY KEY,
  interaction_number text UNIQUE,         -- INT-YYYY-NNNNN
  interaction_type text,                  -- 'chat'
  channel text,                           -- 'live_chat' | 'voice'
  customer_id uuid,
  customer_name text,
  content_text jsonb,                     -- Messages array
  source_system text,                     -- 'ai_chat_widget'
  resolution_status text,                 -- 'open'|'resolved'|'abandoned'
  metadata jsonb,                         -- { interaction_type: 'voice'|'text' }
  integration_metadata jsonb,             -- { referrer_url, customer_email }
  sentiment_score numeric,
  duration_seconds integer,
  total_tokens integer,
  total_cost_cents integer,
  created_ts timestamptz DEFAULT now()
);
```

**Table:** `app.d_booking` - Created via AI chat

```sql
CREATE TABLE app.d_booking (
  id uuid PRIMARY KEY,
  booking_number text UNIQUE,             -- BK-YYYY-NNNNNN
  booking_source text,                    -- 'ai_widget'
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  service_id uuid REFERENCES d_service,
  requested_date date NOT NULL,
  requested_time_start time NOT NULL,
  assigned_employee_id uuid REFERENCES d_employee,
  booking_status text,                    -- 'pending'|'confirmed'|'completed'
  interaction_session_id uuid REFERENCES f_customer_interaction,
  created_ts timestamptz DEFAULT now()
);
```

### API Endpoints

#### Text Chat
```
POST /api/v1/chat/session/new
Body: { customer_email, customer_name, referrer_url }
Response: { session_id, greeting, timestamp }

POST /api/v1/chat/message
Body: { session_id, message }
Headers: Authorization: Bearer <JWT>
Response: { response, function_calls, tokens_used }
```

#### Voice Chat
```
WebSocket /api/v1/chat/voice/call?token=<JWT>&name=...&email=...
→ { type: 'input_audio_buffer.append', audio: <base64 PCM16> }
← { type: 'response.audio.delta', delta: <base64> }
← { type: 'response.audio_transcript.done', transcript: "..." }
```

### Frontend Components

**Widget** (`apps/widget/src/`):
- `App.tsx` - Main container with text/voice toggle
- `VoiceCall.tsx` - Voice call UI with WebRTC audio
- `styles.css` - Complete widget styling (600+ lines)
- Built to `public/widget/widget.js` (467KB UMD bundle)

**Main App Integration**:
- `/booking` - EntityMainPage for all bookings
- `/booking/:id` - EntityDetailPage for single booking
- `entityConfig.ts` - Booking entity configuration

---

## 4. Entity Relationships

### d_booking Relationships
```
d_booking
├── service_id → d_service (service being booked)
├── assigned_employee_id → d_employee (technician assigned)
├── interaction_session_id → f_customer_interaction (chat session)
└── customer_id → d_cust (if registered customer)
```

### f_customer_interaction Relationships
```
f_customer_interaction
├── customer_id → d_cust (if known customer)
└── content_text (JSONB) → Array of messages
    ├── { role: 'user', content: "..." }
    ├── { role: 'assistant', content: "..." }
    └── { role: 'function', name: 'create_booking', content: "{...}" }
```

### d_service & d_employee
```
d_service
├── id (used by create_booking function)
├── service_category (HVAC, Plumbing, etc.)
└── standard_rate_amt (pricing)

d_employee
├── id (used for assignment)
├── department (matched to service_category)
└── d_employee_calendar → d_calendar (availability)
```

---

## 5. Central Configuration & Middleware

### Auth Token Flow

**Frontend → Backend**
```typescript
// Text chat
fetch('/api/v1/chat/message', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
});

// Voice chat
new WebSocket(`/chat/voice/call?token=${encodeURIComponent(token)}`);
```

**Backend → MCP Tools**
```typescript
// Extract token
const authToken = request.headers.authorization?.replace('Bearer ', '') ||
                 request.query?.token;

// Pass to MCP executor
const result = await executeMCPTool('create_booking', args, authToken);
```

### MCP Tool Configuration

**File:** `apps/api/src/modules/chat/mcp-adapter.service.ts`

```typescript
export function getCustomerServiceTools(): ChatCompletionTool[] {
  return getMCPTools({
    categories: [
      'Project', 'Task', 'Customer', 'Service',
      'Employee', 'Booking'
    ],
    excludeEndpoints: [
      'auth_login', 'auth_logout',
      'customer_signup', 'customer_signin'
    ],
    maxTools: 50  // OpenAI token limit
  });
}
```

**Why 50 tools?** OpenAI has ~16k token limit for system prompts + tools. 126 tools ≈ 20k tokens (exceeds limit). Customer service needs projects, tasks, bookings, services, employees, customers. Admin tools excluded.

### Environment Variables
```bash
# Required
OPENAI_API_KEY=sk-proj-...

# Optional
OPENAI_MODEL=gpt-4-turbo-preview
NODE_ENV=production
```

---

## 6. User Interaction Flow Examples

### Example 1: Text Chat - Book HVAC Service

```
User: "I need my furnace serviced"

AI calls: get_available_services({ category: 'HVAC' })
→ Returns: [{ id: '...', name: 'Furnace Maintenance', price: '$150' }]

AI: "I can help! Our furnace maintenance service is $150.
     When would you like to schedule it?"

User: "Next Tuesday at 2pm"

AI calls: get_employee_availability({ date: '2025-11-12', category: 'HVAC' })
→ Returns: [{ id: 'emp-123', name: 'John Smith', available: true }]

AI: "Great! John Smith is available. May I have your name and address?"

User: "Sarah Johnson, 123 Main St, Toronto"

AI calls: create_booking({
  service_id: '...',
  customer_name: 'Sarah Johnson',
  customer_phone: '416-555-1234',
  customer_address: '123 Main St, Toronto',
  requested_date: '2025-11-12',
  requested_time_start: '14:00',
  assigned_employee_id: 'emp-123'
})
→ Returns: { booking_number: 'BK-2025-00042', success: true }

AI: "Perfect! Your booking is confirmed.
     Booking #: BK-2025-00042
     Service: Furnace Maintenance
     Date: Nov 12, 2025 at 2:00 PM
     Technician: John Smith"
```

### Example 2: Voice Chat - Check Project Status

```
User: (speaks) "What's the status of the downtown renovation project?"

AI (transcription via Whisper)
→ "What's the status of the downtown renovation project?"

AI calls: project_list({ filters: { name: 'downtown renovation' } })
→ Returns: [{ id: '...', name: 'Downtown Renovation', stage: 'In Progress' }]

AI (voice response)
→ Audio: "The downtown renovation project is currently in progress.
          Would you like more details about specific tasks?"

User: (speaks) "Yes, what tasks are pending?"

AI calls: task_list({ project_id: '...', stage: 'pending' })
→ Returns: [{ name: 'Electrical Inspection', due: '2025-11-10' }, ...]

AI (voice response)
→ Audio: "There are 3 pending tasks. The most urgent is the
          electrical inspection due on November 10th."
```

---

## 7. Critical Considerations When Building

### For Developers Extending This System

#### 1. **Always Use MCP Adapter**
```typescript
// ❌ WRONG
const result = await functionTools.create_booking(args);

// ✅ CORRECT
const result = await executeMCPTool('create_booking', args, authToken);
```
**Why:** MCP adapter ensures authenticated API calls with proper error handling.

#### 2. **Handle Race Conditions**
The retry logic in `conversation.service.ts:createSession()` is **critical**. Multiple users clicking chat simultaneously cause duplicate interaction numbers without retry.

#### 3. **Voice vs Text Tool Format**
- **Text Chat**: `ChatCompletionTool` format (with `type: 'function'` wrapper)
- **Voice Chat**: Unwrapped function definitions
Use `convertMCPToolsToRealtimeFormat()` to convert.

#### 4. **Auth Token Must Be Passed**
Without auth token, MCP tools fall back to legacy function tools (only 3). Verify:
```typescript
if (!authToken) {
  console.warn('⚠️ No auth token - limited tool access');
}
```

#### 5. **Tool Limit is 50**
126 MCP tools exceed OpenAI token limits. `maxTools: 50` filters to customer-service-relevant tools only.

#### 6. **Audio Format Must Be PCM16 @ 24kHz**
```typescript
// Frontend audio processing
const audioContext = new AudioContext({ sampleRate: 24000 });
const pcm16 = new Int16Array(inputData.length);
for (let i = 0; i < inputData.length; i++) {
  const s = Math.max(-1, Math.min(1, inputData[i]));
  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
}
const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
```
**Why:** OpenAI Realtime API requires PCM16. Wrong format = silent audio.

#### 7. **Voice Sessions Clean Up Automatically**
```typescript
clientWs.on('close', () => {
  this.cleanup();  // Closes OpenAI connection
});
```
No manual cleanup needed.

### Security Considerations

**Auth Token Transmission:**
- ✅ Text Chat: Bearer token in `Authorization` header (HTTPS)
- ⚠️ Voice Chat: Token in query param (WSS connection)
- **Recommendation:** Move token to WebSocket upgrade headers instead of query params to avoid server log exposure.

**RBAC Enforcement:**
All MCP tool calls execute with user's JWT token → RBAC checked at API layer.
```
User with "view-only" role calls create_booking
→ executeMCPTool('create_booking', args, userToken)
→ API returns 403 Forbidden
→ AI responds: "I don't have permission to create bookings."
```

**SQL Injection Protection:**
All queries use parameterized queries via `postgres` tagged templates:
```typescript
await client`INSERT INTO app.f_customer_interaction VALUES (${sessionId}, ...)`
```

### Performance Optimization

**Current Capacity:**
- Concurrent Sessions: ~10k per server (WebSocket limit)
- Token Usage: ~2k tokens per text message (with tool calls)
- Audio Latency: 200-500ms for voice responses
- Database Load: 2-3 queries per message

**Bottlenecks:**
1. OpenAI API Rate Limits: 10k req/min (GPT-4), 50 req/min (Realtime)
2. Database Writes: Session updates on every message
3. WebSocket Connections: Each voice session = 2 WebSockets

**Optimization Recommendations:**
1. Batch session updates (every N messages vs every message)
2. Cache `getCustomerServiceTools()` result
3. Connection pooling for database

### Testing & Verification

**Test Text Chat:**
```bash
./tools/test-api.sh POST /api/v1/chat/session/new '{
  "customer_email": "test@example.com"
}'

./tools/test-api.sh POST /api/v1/chat/message '{
  "session_id": "<ID>",
  "message": "What services do you offer?"
}'
```

**Test Voice Chat:**
```javascript
// Browser console on http://localhost:5173
// Click voice button, observe logs:
// "✅ OpenAI Realtime connected"
// "📡 Loading 50 MCP tools for voice agent"
```

### Monitoring & Logging

**Key Metrics:**
```sql
-- Session creation rate
SELECT DATE(created_ts), COUNT(*)
FROM f_customer_interaction
WHERE source_system = 'ai_chat_widget'
GROUP BY DATE(created_ts);

-- Token usage & costs
SELECT SUM(total_tokens), SUM(total_cost_cents)/100.0
FROM f_customer_interaction
WHERE source_system = 'ai_chat_widget';

-- Booking conversion rate
SELECT
  COUNT(*) as total_chats,
  COUNT(CASE WHEN EXISTS (
    SELECT 1 FROM d_booking b WHERE b.interaction_session_id = f.id
  ) THEN 1 END) as bookings_created
FROM f_customer_interaction f
WHERE source_system = 'ai_chat_widget';
```

### Files Modified

**Backend:**
```
apps/api/src/modules/chat/
├── mcp-adapter.service.ts       ← NEW: MCP tool converter
├── openai.service.ts             ← MODIFIED: Added MCP integration
├── voice.service.ts              ← MODIFIED: Added MCP tools
├── voice.routes.ts               ← MODIFIED: Pass auth token
├── routes.ts                     ← MODIFIED: Pass auth token
└── conversation.service.ts       ← MODIFIED: Retry logic
```

**Frontend:**
```
apps/web/src/components/chat/
└── ChatWidget.tsx                ← MODIFIED: Pass token in WebSocket
```

**Total Changes:**
- 1 file created: `mcp-adapter.service.ts`
- 6 files modified
- ~300 lines added

---

## Quick Start

### 1. Configure OpenAI API Key
```bash
# .env
OPENAI_API_KEY=sk-your-actual-key-here
```

### 2. Start API
```bash
./tools/start-api.sh
```

### 3. Test Chat
Open: `http://localhost:4000/widget/demo.html`

### 4. Test Voice
Click phone button (📞), allow microphone, speak!

---

## Cost Estimation

**Text Chat:** ~$0.05 per conversation
**Voice Chat:** ~$0.06 per minute (~$0.30 for 5 min call)
**Monthly (1,000 conversations):** ~$50-100

---

## Architecture Decision Records

### ADR-001: Why MCP Instead of Direct Function Tools?
**Decision:** Use MCP Server API manifest instead of hardcoded function tools.
**Rationale:**
- Single Source of Truth: API manifest already defines 126 endpoints
- Automatic Updates: New endpoints automatically available to AI
- Consistency: Same tools for text, voice, and MCP clients
- Maintainability: No duplicate definitions

**Trade-offs:**
- Added complexity: MCP adapter layer
- Token limits: Can't use all 126 tools (limited to 50)

### ADR-002: Why 50 Tool Limit?
**Decision:** Filter MCP tools to 50 customer-service-relevant endpoints.
**Rationale:**
- OpenAI ~16k token limit for system prompts + tools
- 126 tools ≈ 20k tokens (exceeds limit)
- Customer service needs: projects, tasks, bookings, services, employees
- Admin tools: office/role management → not needed for chat

---

**Version:** 2.0.0
**Status:** ✅ Production Ready
**Last Updated:** 2025-11-05
