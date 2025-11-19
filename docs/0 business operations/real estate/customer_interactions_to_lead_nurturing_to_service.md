# Real Estate Agent Call-to-Lead System
**Built on the PMO Self-Service Software Platform**

> **Platform Philosophy**: The PMO platform is a self-service software platform where domain experts can build industry-specific applications using pre-built building blocks, design patterns, and data models. This document demonstrates how a real estate CRM application leverages the platform's universal entity system, AI chat infrastructure, and workflow automation.

---

## 📋 Table of Contents
1. [Business Semantics](#business-semantics)
2. [Technical Building Blocks](#technical-building-blocks)
3. [System Design](#system-design)
4. [Tooling & Services](#tooling--services)
5. [Process Flow](#process-flow)
6. [Mobile App Experience](#mobile-app-experience)
7. [Platform Configuration](#platform-configuration)

---

## 1. Business Semantics

### 1.1 What is This System?

The **Real Estate Agent Call-to-Lead System** is an intelligent customer acquisition and service automation platform that transforms phone conversations into actionable business data. It automatically:

- **Captures** incoming customer calls via dedicated Twilio numbers
- **Transcribes** conversations in real-time using voice-to-text technology
- **Analyzes** customer intent and extracts structured data using AI
- **Creates** customer records, calendar bookings, and service tasks automatically
- **Notifies** both agents and customers via SMS and push notifications

### 1.2 Why This System Exists

**Business Problems Solved:**

| Challenge | Solution |
|-----------|----------|
| **Manual data entry** after every customer call | Automatic customer record creation from conversation transcripts |
| **Lost leads** from anonymous callers | Every call creates a tracked lead in CRM |
| **Forgotten follow-ups** | Auto-generated tasks with calendar reminders |
| **Scheduling friction** | AI-driven appointment booking during the call |
| **No conversation history** | Full call transcripts stored with customer records |
| **Inconsistent data capture** | Standardized AI extraction of name, phone, address, requirements |

**Business Value:**

- **30% faster lead response time** - No manual CRM entry delay
- **Zero missed leads** - Every call becomes a tracked opportunity
- **100% conversation capture** - Full audit trail for compliance/training
- **Automated task assignment** - Service requests auto-route to agents
- **Seamless customer experience** - Instant booking confirmations via text

### 1.3 Who Uses This System?

| User Type | Role | Primary Activities |
|-----------|------|-------------------|
| **Real Estate Agents** | Call recipients, service providers | Receive calls, view transcripts, manage tasks, complete bookings |
| **Property Buyers/Sellers** | Anonymous/Known customers | Call agents, discuss requirements, receive booking confirmations |
| **Office Managers** | Lead supervisors | Monitor call quality, review lead conversion, assign territories |
| **Marketing Team** | Lead analysts | Track acquisition channels, analyze customer intent, optimize campaigns |

---

## 2. Technical Building Blocks

This application is built **entirely** using the PMO platform's existing infrastructure. No custom backend code required.

### 2.1 Platform Components Leveraged

| Component | Purpose | Platform Path |
|-----------|---------|---------------|
| **Universal Entity System** | Customer, Task, Calendar booking CRUD | `apps/web/src/lib/entityConfig.ts` |
| **AI Chat System v6.0** | Voice transcription + LLM analysis | `apps/api/src/modules/ai-chat/` |
| **MCP Function Tools** | Entity creation via AI | `apps/api/src/modules/ai-chat/tools/` |
| **Person-Calendar System** | Event booking + RSVP management | `apps/api/src/modules/calendar/` |
| **Notification Service** | SMS/Push notifications | `apps/api/src/modules/notification/` |
| **Voice Infrastructure** | Twilio integration, WebSocket audio | `apps/api/src/modules/ai-chat/routes-voice.ts` |
| **Entity Linkage System** | Customer ↔ Task ↔ Calendar relationships | `d_entity_instance_link` table |
| **RBAC System** | Agent-owned customers/tasks | `d_entity_rbac` table |

### 2.2 Data Model Entities Used

```
Customer Entity (d_customer / d_client)
├── Fields: name, phone, email, address, customer_tier, acquisition_channel
├── Linked to: Tasks (service requests), Calendar events (appointments)
└── RBAC: Agent ownership (permission[0]=view, [1]=edit, [4]=create)

Task Entity (d_task)
├── Fields: name, description, assignee_id, status, priority, due_date
├── Linked to: Customer (parent), Calendar event (scheduled work)
└── RBAC: Assigned agent (edit/complete permissions)

Calendar Event Entity (d_entity_person_calendar)
├── Fields: event_name, start_time, end_time, location, attendees
├── Linked to: Customer (attendee), Agent (host), Task (service work)
└── RBAC: Event creator (permission[5]=ownership)

Call Transcript Entity (d_artifact)
├── Fields: artifact_type='TRANSCRIPT', content (JSONB), s3_url
├── Linked to: Customer (parent entity)
└── RBAC: Agent view-only access
```

### 2.3 AI Chat System Integration

```typescript
// Voice Call Flow using AI Chat System v6.0
// Reference: docs/ai_chat/AI_CHAT_SYSTEM.md

1. Voice Input (Twilio → WebSocket)
   → apps/api/src/modules/ai-chat/routes-voice.ts
   → Streams audio chunks to Deepgram STT

2. Transcription (Deepgram)
   → Real-time speech-to-text
   → Buffered text sent to LLM

3. LLM Analysis (GPT-4o mini + MCP Tools)
   → Semantic intent detection ("new customer" vs "existing customer")
   → Structured data extraction (name, phone, service request)
   → Function calling: create_customer, create_task, create_calendar_event

4. MCP Tool Execution
   → POST /api/v1/customer (if new)
   → POST /api/v1/task (service request)
   → POST /api/v1/calendar (appointment booking)
   → POST /api/v1/entity-linkage (customer ↔ task ↔ calendar)

5. Voice Response (ElevenLabs TTS)
   → Confirmation: "I've booked you for Tuesday at 2pm with Sarah. You'll receive a text shortly."
   → Streamed back to caller via WebSocket
```

**60+ MCP Function Tools Available** (from platform):
- `create_customer`, `get_customer`, `update_customer`, `search_customers`
- `create_task`, `assign_task`, `update_task_status`
- `create_calendar_event`, `check_availability`, `send_calendar_invite`
- `send_sms`, `send_push_notification`, `send_email`
- `link_entities`, `get_entity_relationships`, `check_rbac_permission`

---

## 3. System Design

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER JOURNEY                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │   📱 Customer Calls   │
                        │   Twilio Number       │
                        │   (555-REAL-ESTATE)   │
                        └───────────┬───────────┘
                                    │
                        ┌───────────▼───────────┐
                        │ 🎙️ Agent Mobile App   │
                        │  - Call notification  │
                        │  - Answer/Decline     │
                        │  - Live transcription │
                        └───────────┬───────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│                    PMO PLATFORM BACKEND                               │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  VOICE INFRASTRUCTURE (Twilio + WebSocket)                  │    │
│  │  apps/api/src/modules/ai-chat/routes-voice.ts              │    │
│  │                                                             │    │
│  │  1. WebSocket Connection                                   │    │
│  │     - Bidirectional audio streaming                        │    │
│  │     - Session management (LowDB)                           │    │
│  │     - Call metadata (caller_id, agent_id, duration)        │    │
│  └────────────────────────┬────────────────────────────────────┘    │
│                           │                                         │
│  ┌────────────────────────▼───────────────────────────────────┐    │
│  │  TRANSCRIPTION PIPELINE (Deepgram STT)                     │    │
│  │                                                             │    │
│  │  - Real-time voice-to-text conversion                      │    │
│  │  - Speaker diarization (Agent vs Customer)                 │    │
│  │  - Buffered text aggregation                               │    │
│  │  - Confidence scoring                                      │    │
│  └────────────────────────┬────────────────────────────────────┘    │
│                           │                                         │
│  ┌────────────────────────▼───────────────────────────────────┐    │
│  │  AI ANALYSIS ENGINE (GPT-4o mini + MCP)                    │    │
│  │  apps/api/src/modules/ai-chat/service.ts                   │    │
│  │                                                             │    │
│  │  Semantic Intent Detection:                                │    │
│  │  ✓ "I'm interested in viewing a property" → Lead          │    │
│  │  ✓ "I need a home inspection" → Service Request           │    │
│  │  ✓ "Can we schedule for Tuesday?" → Calendar Booking      │    │
│  │                                                             │    │
│  │  Structured Data Extraction:                               │    │
│  │  {                                                          │    │
│  │    "customer_name": "John Smith",                          │    │
│  │    "phone": "+1-555-0123",                                 │    │
│  │    "address": "123 Main St, Toronto",                      │    │
│  │    "service_type": "Property Viewing",                     │    │
│  │    "preferred_date": "2025-11-15T14:00:00Z"                │    │
│  │  }                                                          │    │
│  │                                                             │    │
│  │  MCP Function Orchestration:                               │    │
│  │  1. search_customers(phone="+1-555-0123")                  │    │
│  │     → Existing customer? Use ID, else create new           │    │
│  │  2. create_task(customer_id, type="Property Viewing")      │    │
│  │  3. create_calendar_event(agent_id, customer_id, time)     │    │
│  │  4. link_entities(customer ↔ task ↔ calendar)             │    │
│  │  5. send_sms(customer_phone, booking_confirmation)         │    │
│  └────────────────────────┬────────────────────────────────────┘    │
│                           │                                         │
│  ┌────────────────────────▼───────────────────────────────────┐    │
│  │  ENTITY OPERATIONS (Universal CRUD API)                    │    │
│  │  apps/api/src/modules/{customer,task,calendar}/           │    │
│  │                                                             │    │
│  │  POST /api/v1/customer                                     │    │
│  │  → Creates d_customer record                               │    │
│  │  → Adds entity_instance_id in d_entity_instance_registry         │    │
│  │  → Sets RBAC (agent ownership in d_entity_rbac)       │    │
│  │                                                             │    │
│  │  POST /api/v1/task                                         │    │
│  │  → Creates d_task record                                   │    │
│  │  → Assigns to agent (assignee_id)                          │    │
│  │  → Links to customer via d_entity_instance_link                   │    │
│  │                                                             │    │
│  │  POST /api/v1/calendar                                     │    │
│  │  → Creates d_entity_person_calendar (event)                │    │
│  │  → Creates d_entity_event_person_calendar (RSVP/attendees) │    │
│  │  → Links to task via d_entity_instance_link                       │    │
│  └────────────────────────┬────────────────────────────────────┘    │
│                           │                                         │
│  ┌────────────────────────▼───────────────────────────────────┐    │
│  │  NOTIFICATION SERVICE                                      │    │
│  │  apps/api/src/modules/notification/                        │    │
│  │                                                             │    │
│  │  SMS (Twilio):                                             │    │
│  │  "Hi John! Your property viewing is confirmed for          │    │
│  │   Tuesday Nov 15 at 2pm with Agent Sarah.                  │    │
│  │   Address: 123 Main St. Reply CANCEL to reschedule."       │    │
│  │                                                             │    │
│  │  Push Notification (Firebase):                             │    │
│  │  Agent App: "New task: Property Viewing - John Smith"      │    │
│  │  Customer App: "Booking confirmed: Tue 2pm with Sarah"     │    │
│  │                                                             │    │
│  │  Email (AWS SES):                                          │    │
│  │  Sends .ics calendar invite to both parties                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │  💾 PostgreSQL DB     │
                        │  - d_customer         │
                        │  - d_task             │
                        │  - d_entity_person_   │
                        │    calendar           │
                        │  - d_entity_instance_link    │
                        │  - d_entity_rbac │
                        └───────────────────────┘
```

### 3.2 Data Flow Diagrams

#### Scenario A: New Customer Call (Anonymous Lead)

```
Customer → Twilio → Agent Mobile App → WebSocket → Deepgram STT
                                                        │
                                                        ▼
                                            "Hi, I'm John Smith,
                                             interested in viewing
                                             123 Main St on Tuesday"
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │ GPT-4o mini     │
                                              │ Intent: LEAD    │
                                              │ Action: CREATE  │
                                              └────────┬────────┘
                                                       │
                                ┌──────────────────────┼──────────────────────┐
                                ▼                      ▼                      ▼
                        MCP: create_customer   MCP: create_task    MCP: create_calendar
                                │                      │                      │
                                ▼                      ▼                      ▼
                        d_customer (NEW)       d_task (NEW)        d_entity_person_calendar
                        - id: uuid-A           - id: uuid-B        - id: uuid-C
                        - name: "John Smith"   - name: "Property   - event_name: "Property
                        - phone: +1-555-0123     Viewing"            Viewing - John Smith"
                        - tier: "LEAD"         - assignee: agent-1 - start: 2025-11-15 14:00
                        - channel: "PHONE"     - customer: uuid-A  - attendees: [agent-1,
                                               - status: "PENDING"   uuid-A]
                                │                      │                      │
                                └──────────────────────┼──────────────────────┘
                                                       ▼
                                            d_entity_instance_link (LINKAGES)
                                            1. CUSTOMER uuid-A ↔ TASK uuid-B
                                            2. TASK uuid-B ↔ CALENDAR uuid-C
                                                       │
                                                       ▼
                                            d_entity_rbac (PERMISSIONS)
                                            1. agent-1 → CUSTOMER uuid-A [view, edit]
                                            2. agent-1 → TASK uuid-B [view, edit, complete]
                                            3. agent-1 → CALENDAR uuid-C [ownership]
                                                       │
                        ┌──────────────────────────────┼──────────────────────────────┐
                        ▼                              ▼                              ▼
                  SMS to Customer            Push to Agent App            Email (.ics invite)
                  "Booking confirmed"        "New task assigned"          Calendar attachment
```

#### Scenario B: Existing Customer Call (Service Request)

```
Customer (existing) → Call → Transcription → LLM
                                                │
                                                ▼
                                    "Hi, it's John Smith again,
                                     need a home inspection ASAP"
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │ MCP: search_customers │
                                    │ phone: +1-555-0123    │
                                    │ → FOUND: uuid-A       │
                                    └───────────┬───────────┘
                                                │
                                ┌───────────────┴───────────────┐
                                ▼                               ▼
                        MCP: create_task              MCP: create_calendar
                        - customer_id: uuid-A         - customer_id: uuid-A
                        - type: "Home Inspection"     - event_type: "Inspection"
                        - priority: "HIGH"            - urgency: "ASAP"
                                │                               │
                                └───────────────┬───────────────┘
                                                ▼
                                        d_entity_instance_link
                                        CUSTOMER uuid-A ↔ TASK (new)
                                        TASK (new) ↔ CALENDAR (new)
                                                │
                                                ▼
                                        Notifications sent
                                        (SMS + Push + Email)
```

### 3.3 Database Schema Integration

```sql
-- Customer Record (d_customer)
CREATE TABLE app.d_customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    customer_tier VARCHAR(50),  -- 'LEAD', 'PROSPECT', 'ACTIVE', 'VIP'
    acquisition_channel VARCHAR(50),  -- 'PHONE', 'WEB', 'REFERRAL', 'WALK_IN'
    created_ts TIMESTAMPTZ DEFAULT NOW(),
    active_flag BOOLEAN DEFAULT TRUE
);

-- Task Record (d_task)
CREATE TABLE app.d_task (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200),
    description TEXT,
    assignee_id UUID,  -- References d_employee (agent)
    status VARCHAR(50),  -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    priority VARCHAR(50),  -- 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    due_date TIMESTAMPTZ,
    created_ts TIMESTAMPTZ DEFAULT NOW(),
    active_flag BOOLEAN DEFAULT TRUE
);

-- Calendar Event (d_entity_person_calendar)
CREATE TABLE app.d_entity_person_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name VARCHAR(200),
    event_type VARCHAR(50),  -- 'PROPERTY_VIEWING', 'HOME_INSPECTION', 'CONSULTATION'
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    location TEXT,
    created_by UUID,  -- Agent who created (RBAC permission[5]=ownership)
    created_ts TIMESTAMPTZ DEFAULT NOW(),
    active_flag BOOLEAN DEFAULT TRUE
);

-- Event Attendees (d_entity_event_person_calendar)
CREATE TABLE app.d_entity_event_person_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID,  -- References d_entity_person_calendar
    person_id UUID,  -- Customer or Agent UUID
    person_type VARCHAR(50),  -- 'CUSTOMER', 'AGENT'
    rsvp_status VARCHAR(50),  -- 'PENDING', 'ACCEPTED', 'DECLINED'
    notification_sent BOOLEAN DEFAULT FALSE,
    created_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Entity Linkages (d_entity_instance_link)
CREATE TABLE app.d_entity_instance_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type VARCHAR(50),  -- 'CUSTOMER'
    parent_entity_id UUID,            -- uuid-A
    child_entity_type VARCHAR(50),    -- 'TASK'
    child_entity_id UUID,             -- uuid-B
    created_ts TIMESTAMPTZ DEFAULT NOW()
);

-- RBAC Permissions (d_entity_rbac)
CREATE TABLE app.d_entity_rbac (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50),
    entity_id UUID,
    permission_user_id UUID,  -- Agent UUID
    permission JSONB,  -- [0:view, 1:edit, 2:share, 3:delete, 4:create, 5:ownership]
    created_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Call Transcript Storage (d_artifact)
CREATE TABLE app.d_artifact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_type VARCHAR(50),  -- 'TRANSCRIPT'
    content JSONB,  -- { transcript, speaker_labels, timestamps, intent_analysis }
    s3_url TEXT,  -- Audio recording URL
    created_ts TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Tooling & Services

### 4.1 Third-Party Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Twilio Voice** | Phone number provisioning, call routing | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| **Deepgram** | Real-time speech-to-text transcription | `DEEPGRAM_API_KEY` |
| **OpenAI GPT-4o mini** | LLM analysis, intent detection, data extraction | `OPENAI_API_KEY` |
| **ElevenLabs** | Text-to-speech for voice responses | `ELEVENLABS_API_KEY` |
| **AWS SES** | Email notifications with .ics calendar invites | `AWS_SES_REGION`, `AWS_SES_FROM_EMAIL` |
| **Firebase Cloud Messaging** | Push notifications to mobile apps | `FCM_SERVER_KEY` |

### 4.2 Platform Services (Built-in)

| Service | Platform Module | Purpose |
|---------|----------------|---------|
| **AI Chat Service** | `apps/api/src/modules/ai-chat/` | Voice call orchestration, LLM integration |
| **MCP Tools Registry** | `apps/api/src/modules/ai-chat/tools/` | 60+ function tools for entity operations |
| **Entity API** | `apps/api/src/modules/{customer,task,calendar}/` | CRUD operations for all entities |
| **Notification Service** | `apps/api/src/modules/notification/` | SMS, Email, Push notification dispatcher |
| **RBAC Service** | `apps/api/src/lib/rbac-check.ts` | Permission validation |
| **Session Management** | `apps/api/src/modules/ai-chat/lib/session-manager.ts` | LowDB-based call session tracking |

### 4.3 Development Tools

```bash
# Test voice call endpoint
./tools/test-api.sh POST /api/v1/ai-chat/voice/start \
  '{"agent_id":"uuid","caller_phone":"+15550123"}'

# Test MCP tool execution
./tools/test-api.sh POST /api/v1/ai-chat/tools/execute \
  '{"tool":"create_customer","params":{"name":"John Smith","phone":"+15550123"}}'

# Test notification dispatch
./tools/test-api.sh POST /api/v1/notification/send \
  '{"type":"SMS","recipient":"+15550123","message":"Test"}'

# View AI chat logs
./tools/logs-api.sh | grep "ai-chat"

# Monitor call sessions
./tools/test-api.sh GET /api/v1/ai-chat/sessions
```

---

## 5. Process Flow

### 5.1 End-to-End Call Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CALL LIFECYCLE STAGES                          │
└─────────────────────────────────────────────────────────────────────┘

STAGE 1: CALL INITIATION (0-5 seconds)
────────────────────────────────────────
Customer Action:
  → Dials Twilio number (555-REAL-ESTATE)
  → Hears ringing tone

Platform Processing:
  1. Twilio receives call → Webhook to /api/v1/ai-chat/voice/incoming
  2. Lookup agent availability (round-robin or territory-based)
  3. Send push notification to agent mobile app
     {
       "type": "INCOMING_CALL",
       "caller_id": "+1-555-0123",
       "caller_name": "John Smith" (if existing customer),
       "territory": "Downtown Toronto"
     }

Agent Mobile App:
  → Full-screen call notification with "Accept" / "Decline" buttons
  → Displays caller info (name if known, phone number, last interaction date)


STAGE 2: CALL CONNECTION (5-10 seconds)
────────────────────────────────────────
Agent Action:
  → Taps "Accept" button

Platform Processing:
  1. WebSocket connection established (Agent App ↔ Backend)
  2. Twilio connects caller audio to WebSocket stream
  3. Deepgram STT connection initialized
  4. LLM session created with context:
     {
       "session_id": "call-uuid",
       "agent_id": "agent-uuid",
       "caller_phone": "+1-555-0123",
       "existing_customer_id": "uuid-A" (if found),
       "previous_interactions": [...] (if existing customer)
     }

Agent Mobile App:
  → Shows active call screen:
    - Caller info card at top
    - Live transcription feed (scrolling text)
    - Call duration timer
    - Mute/Speaker/Hang-up buttons
    - "Create Task" quick action button


STAGE 3: CONVERSATION (10 seconds - 5 minutes)
────────────────────────────────────────────────
Customer Speech:
  "Hi, my name is John Smith. I'm interested in viewing the property
   at 123 Main Street. Are you available this Tuesday around 2pm?"

Platform Processing (Real-time):
  1. Audio chunks → Deepgram STT → Text segments
  2. Text buffered and sent to GPT-4o mini every 3 seconds
  3. LLM analyzes partial transcript:
     - Intent detection: "PROPERTY_VIEWING"
     - Data extraction:
       {
         "customer_name": "John Smith",
         "property_address": "123 Main Street",
         "preferred_date": "Tuesday",
         "preferred_time": "2pm"
       }
  4. LLM prepares agent response suggestions:
     - "Confirm availability"
     - "Ask for phone number"
     - "Suggest alternative times"

Agent Mobile App (Live Updates):
  → Transcription feed shows:
    ┌──────────────────────────────────────┐
    │ Customer:                            │
    │ "Hi, my name is John Smith..."       │
    │                                      │
    │ Agent:                               │
    │ "Hi John! Let me check my calendar..." │
    └──────────────────────────────────────┘

  → AI Suggestion Card (optional):
    ┌──────────────────────────────────────┐
    │ 💡 Suggested Actions:                │
    │ [Create Task: Property Viewing]      │
    │ [Check Availability: Tue 2pm]        │
    │ [Ask for Contact Info]               │
    └──────────────────────────────────────┘


STAGE 4: DATA CAPTURE (During conversation)
────────────────────────────────────────────
LLM Continuous Analysis:
  → Extracts structured data as conversation progresses
  → Updates session state in LowDB:
    {
      "customer": {
        "name": "John Smith",
        "phone": "+1-555-0123" (captured from caller ID or verbal),
        "email": "john@example.com" (if mentioned),
        "address": null
      },
      "service_request": {
        "type": "PROPERTY_VIEWING",
        "property_address": "123 Main Street",
        "preferred_date": "2025-11-15",
        "preferred_time": "14:00"
      },
      "intent": "SCHEDULE_APPOINTMENT"
    }

Agent Actions (Optional):
  → Agent can manually tap "Create Task" during call
  → Can edit extracted data in real-time if AI misheard


STAGE 5: CALL CONCLUSION (Last 30 seconds)
────────────────────────────────────────────
Agent Speech:
  "Perfect, John! I've booked you for Tuesday November 15th at 2pm
   to view 123 Main Street. You'll receive a text confirmation shortly.
   Is there anything else I can help with?"

Customer: "No, that's all. Thank you!"

Platform Processing:
  1. LLM detects call completion signal
  2. Final data validation:
     - Check if customer exists (search by phone)
     - Verify all required fields captured
  3. Trigger MCP tool sequence:
     a) If new customer: create_customer()
     b) create_task(type="PROPERTY_VIEWING")
     c) create_calendar_event(start="2025-11-15T14:00:00Z")
     d) link_entities(customer ↔ task ↔ calendar)
     e) set_rbac_permissions(agent → customer, task, calendar)


STAGE 6: POST-CALL AUTOMATION (0-10 seconds after hang-up)
────────────────────────────────────────────────────────────
Agent Action:
  → Taps "End Call" button

Platform Processing (Automatic):
  1. WebSocket connection closed
  2. Final transcript saved to d_artifact (JSONB + S3 audio URL)
  3. Entity creation completes:
     ✓ Customer record created (or updated)
     ✓ Task created and assigned to agent
     ✓ Calendar event created with both attendees
     ✓ Linkages established in d_entity_instance_link
     ✓ RBAC permissions set

  4. Notification dispatch:

     SMS to Customer (+1-555-0123):
     ─────────────────────────────────
     Hi John! Your property viewing is confirmed:

     📅 Date: Tuesday, Nov 15, 2025
     🕐 Time: 2:00 PM - 3:00 PM
     📍 Location: 123 Main Street
     👤 Agent: Sarah Johnson

     Reply CANCEL to reschedule.
     Save to calendar: [Link]
     ─────────────────────────────────

     Push Notification to Agent Mobile App:
     ─────────────────────────────────
     🆕 New Task Assigned

     Property Viewing - John Smith
     Due: Tue, Nov 15 at 2:00 PM
     123 Main Street

     [View Details] [Mark Complete]
     ─────────────────────────────────

     Email to Both (with .ics attachment):
     ─────────────────────────────────
     Subject: Property Viewing Appointment - Nov 15

     Calendar invite attached.
     Click to add to your calendar.
     ─────────────────────────────────

Agent Mobile App:
  → Shows call summary screen:
    ┌──────────────────────────────────────┐
    │ ✅ Call Completed (3m 42s)           │
    │                                      │
    │ Customer: John Smith (NEW LEAD)      │
    │ Phone: +1-555-0123                   │
    │                                      │
    │ Created:                             │
    │ • Task: Property Viewing             │
    │ • Calendar: Tue Nov 15, 2pm          │
    │                                      │
    │ Notifications Sent:                  │
    │ ✓ SMS to customer                    │
    │ ✓ Calendar invite sent               │
    │                                      │
    │ [View Full Transcript]               │
    │ [Edit Customer Details]              │
    │ [View Task]                          │
    └──────────────────────────────────────┘
```

### 5.2 Decision Tree: New vs Existing Customer

```
Call Received → Transcription → LLM Analysis
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │ MCP: search_customers   │
                        │ phone: caller_id        │
                        └────────┬────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
            CUSTOMER FOUND             CUSTOMER NOT FOUND
            (Existing)                 (New Lead)
                    │                         │
                    ▼                         ▼
        ┌───────────────────────┐    ┌────────────────────────┐
        │ Load customer context │    │ Extract name from      │
        │ - Previous tasks      │    │ conversation           │
        │ - Past interactions   │    │ - "My name is..."      │
        │ - Service history     │    │ - "This is..."         │
        │ - Preferences         │    │                        │
        └───────────┬───────────┘    └────────┬───────────────┘
                    │                         │
                    ▼                         ▼
        ┌───────────────────────┐    ┌────────────────────────┐
        │ MCP: update_customer  │    │ MCP: create_customer   │
        │ (if new info)         │    │ - name                 │
        │                       │    │ - phone                │
        │ MCP: create_task      │    │ - tier: "LEAD"         │
        │ (service request)     │    │ - channel: "PHONE"     │
        │                       │    │                        │
        │ MCP: create_calendar  │    │ MCP: create_task       │
        │ (appointment)         │    │ (property viewing)     │
        │                       │    │                        │
        │ Link to existing      │    │ MCP: create_calendar   │
        │ customer record       │    │ (appointment)          │
        └───────────────────────┘    │                        │
                    │                │ Link to new customer   │
                    │                └────────────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                        Notifications Sent
                        - SMS (different templates)
                        - Push notification
                        - Email with .ics
```

---

## 6. Mobile App Experience

### 6.1 Agent Mobile App Screens

```
┌─────────────────────────────────────────────────────────────────────┐
│ SCREEN 1: INCOMING CALL (Full-Screen Notification)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                       📞 INCOMING CALL                              │
│                                                                     │
│                 ┌─────────────────────────┐                        │
│                 │     👤 John Smith       │                        │
│                 │   +1 (555) 012-0123     │                        │
│                 │                         │                        │
│                 │   Last Contact:         │                        │
│                 │   3 days ago            │                        │
│                 │   (Property Inquiry)    │                        │
│                 └─────────────────────────┘                        │
│                                                                     │
│                                                                     │
│              ┌──────────┐      ┌──────────┐                        │
│              │ DECLINE  │      │  ACCEPT  │                        │
│              │    ❌    │      │    ✅    │                        │
│              └──────────┘      └──────────┘                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│ SCREEN 2: ACTIVE CALL (Live Transcription)                         │
├─────────────────────────────────────────────────────────────────────┤
│  ⬅ Back          John Smith          🔇 Mute  🔊 Speaker  📞 End  │
│                  +1-555-0123                                        │
│                  ⏱️ 01:23                                           │
├─────────────────────────────────────────────────────────────────────┤
│  📝 Live Transcription:                                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Customer: "Hi, I'm interested in viewing the property at      │ │
│  │ 123 Main Street. Are you available this Tuesday?"             │ │
│  │                                                                │ │
│  │ Agent (You): "Let me check my calendar. Yes, Tuesday works!   │ │
│  │ What time were you thinking?"                                 │ │
│  │                                                                │ │
│  │ Customer: "Around 2pm would be perfect."                      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🤖 AI Suggestions:                                                │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ✅ Create Task: Property Viewing                              │ │
│  │ 📅 Schedule: Tue Nov 15, 2pm                                  │ │
│  │ 🏠 Address: 123 Main Street                                   │ │
│  │                                                                │ │
│  │ [Confirm & Create] [Edit Details]                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Quick Actions:                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                 │
│  │ 📋 Task │ │ 📅 Book │ │ 📝 Note │ │ 👤 Edit │                 │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                 │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│ SCREEN 3: CALL SUMMARY (Post-Call)                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ⬅ Back to Dashboard                                               │
│                                                                     │
│  ✅ Call Completed Successfully                                    │
│  Duration: 3m 42s                                                   │
│                                                                     │
│  👤 Customer Information                                           │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Name: John Smith                                              │ │
│  │ Phone: +1-555-0123                                            │ │
│  │ Status: NEW LEAD 🆕                                           │ │
│  │ Acquisition: Phone Call                                       │ │
│  │                                                                │ │
│  │ [View Full Profile] [Edit Details]                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  📋 Tasks Created (1)                                              │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Property Viewing                                              │ │
│  │ 📍 123 Main Street                                            │ │
│  │ ⏰ Tue, Nov 15, 2025 at 2:00 PM                               │ │
│  │ Status: Pending                                               │ │
│  │                                                                │ │
│  │ [View Task] [Mark Complete]                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  📅 Calendar Events (1)                                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Property Viewing - John Smith                                 │ │
│  │ Tue, Nov 15, 2:00 PM - 3:00 PM                                │ │
│  │ Attendees: You, John Smith                                    │ │
│  │                                                                │ │
│  │ [View Event] [Reschedule]                                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  📧 Notifications Sent                                             │
│  ✓ SMS confirmation to customer                                    │
│  ✓ Calendar invite sent (Email + .ics)                             │
│  ✓ Push notification sent                                          │
│                                                                     │
│  📄 Call Transcript                                                │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ [View Full Transcript] [Download Audio]                       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  [Done] [Share Summary]                                             │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│ SCREEN 4: DASHBOARD (Task & Calendar Overview)                     │
├─────────────────────────────────────────────────────────────────────┤
│  ☰ Menu      My Dashboard      🔔 3      ⚙️ Settings               │
│                                                                     │
│  📅 Today's Schedule                                               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 10:00 AM - Home Inspection - Maria Garcia                    │ │
│  │ 📍 456 Oak Avenue                                             │ │
│  │                                                                │ │
│  │ 2:00 PM - Property Viewing - John Smith 🆕                    │ │
│  │ 📍 123 Main Street                                            │ │
│  │                                                                │ │
│  │ 4:30 PM - Consultation - Robert Lee                           │ │
│  │ 📍 Office (Virtual)                                           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  📋 Active Tasks (5)                                               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🔴 URGENT: Follow-up - Downtown Condo                         │ │
│  │    Due: Today, 5:00 PM                                        │ │
│  │                                                                │ │
│  │ 🟡 Property Viewing - John Smith 🆕                           │ │
│  │    Due: Tue, Nov 15, 2:00 PM                                  │ │
│  │                                                                │ │
│  │ 🟢 Submit Offer - Lakeview House                              │ │
│  │    Due: Wed, Nov 16, 12:00 PM                                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  👥 Recent Customers (3)                                           │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🆕 John Smith - Property Viewing (3 min ago)                  │ │
│  │ 📞 Maria Garcia - Home Inspection (2 hours ago)               │ │
│  │ 💬 Robert Lee - Consultation Request (Yesterday)              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ──────────────────────────────────────────────────────────────────│
│  │ 🏠 Home  │ 📅 Calendar │ 📋 Tasks │ 👥 Customers │ 💬 Messages ││
│  ──────────────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│ SCREEN 5: TASK MANAGEMENT (Detailed View)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ⬅ Back to Dashboard                                               │
│                                                                     │
│  📋 Task Details                                                    │
│                                                                     │
│  Property Viewing - John Smith 🆕                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 👤 Customer: John Smith                                       │ │
│  │    Phone: +1-555-0123                                         │ │
│  │    Email: john@example.com                                    │ │
│  │    [View Customer Profile]                                    │ │
│  │                                                                │ │
│  │ 📍 Property Address:                                          │ │
│  │    123 Main Street, Toronto, ON M5V 2T6                       │ │
│  │    [Get Directions] [Street View]                             │ │
│  │                                                                │ │
│  │ ⏰ Scheduled Time:                                            │ │
│  │    Tuesday, Nov 15, 2025                                      │ │
│  │    2:00 PM - 3:00 PM (1 hour)                                 │ │
│  │    [Reschedule] [Add to Calendar]                             │ │
│  │                                                                │ │
│  │ 🎯 Task Type: Property Viewing                                │ │
│  │ 🔴 Priority: HIGH                                             │ │
│  │ 📊 Status: PENDING                                            │ │
│  │                                                                │ │
│  │ 📝 Notes from Call:                                           │ │
│  │    "Customer interested in 2-bedroom condo                    │ │
│  │     in downtown area. Budget: $500k-$600k.                    │ │
│  │     First-time homebuyer. Prefers modern                      │ │
│  │     finishes and near subway."                                │ │
│  │                                                                │ │
│  │ 🎙️ Call Recording:                                            │ │
│  │    Duration: 3m 42s                                           │ │
│  │    [▶️ Play] [📄 View Transcript]                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ✅ Task Checklist:                                                │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ☐ Confirm appointment with customer (1 day before)           │ │
│  │ ☐ Prepare property listing package                           │ │
│  │ ☐ Review property history and comps                          │ │
│  │ ☐ Arrive 15 minutes early                                    │ │
│  │ ☐ Complete showing feedback form                             │ │
│  │ ☐ Schedule follow-up call                                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Quick Actions:                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ 📞 Call      │ │ 💬 Message   │ │ ✅ Complete  │              │
│  │   Customer   │ │   Customer   │ │    Task      │              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ [Mark Complete] [Reassign] [Cancel Task]                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│ SCREEN 6: CUSTOMER PROFILE (Detailed View)                         │
├─────────────────────────────────────────────────────────────────────┤
│  ⬅ Back to Customers                                               │
│                                                                     │
│  👤 John Smith 🆕 LEAD                                             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 📞 +1-555-0123        📧 john@example.com                     │ │
│  │ 📍 Toronto, ON        🏷️ First-Time Buyer                     │ │
│  │ 💰 Budget: $500k-$600k                                        │ │
│  │                                                                │ │
│  │ 📊 Lead Score: 85/100 (Hot Lead 🔥)                           │ │
│  │ 📅 First Contact: Nov 12, 2025 (Today)                        │ │
│  │ 🔗 Source: Phone Call                                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Quick Actions:                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ 📞 Call  │ │ 💬 Text  │ │ ✉️ Email │ │ 📅 Book  │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│                                                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  │ 📋 Tasks (1) │ 🎙️ Calls (1) │ 📅 Meetings (1) │ 📝 Notes (0) │ │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                     │
│  📋 Active Tasks (1)                                               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Property Viewing                                              │ │
│  │ 📍 123 Main Street                                            │ │
│  │ ⏰ Tue, Nov 15, 2:00 PM                                       │ │
│  │ Status: PENDING                                               │ │
│  │ [View Details] [Mark Complete]                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🎙️ Call History (1 call, 3m 42s total)                           │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Incoming Call - Today at 10:23 AM                             │ │
│  │ Duration: 3m 42s                                              │ │
│  │ Outcome: Scheduled Property Viewing                           │ │
│  │                                                                │ │
│  │ 📄 Transcript Preview:                                        │ │
│  │ "Hi, I'm interested in viewing the property at               │ │
│  │  123 Main Street. Are you available this Tuesday?"            │ │
│  │                                                                │ │
│  │ [▶️ Play Recording] [📄 Full Transcript]                      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🏠 Property Preferences (AI-extracted)                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ • Property Type: Condo                                        │ │
│  │ • Bedrooms: 2                                                 │ │
│  │ • Location: Downtown Toronto, near subway                     │ │
│  │ • Budget: $500,000 - $600,000                                 │ │
│  │ • Style: Modern finishes                                      │ │
│  │ • Move-in: Flexible (within 3 months)                         │ │
│  │                                                                │ │
│  │ [Edit Preferences] [Find Matching Properties]                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  📊 Engagement Timeline                                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Nov 12, 10:23 AM - First phone call (3m 42s)                  │ │
│  │ Nov 12, 10:27 AM - Lead created (via AI)                      │ │
│  │ Nov 12, 10:27 AM - Task created: Property Viewing             │ │
│  │ Nov 12, 10:27 AM - Appointment booked: Nov 15, 2pm            │ │
│  │ Nov 12, 10:28 AM - SMS confirmation sent                      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  [Edit Customer] [Add Note] [Convert to Client] [Share]            │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│ SCREEN 7: CALL HISTORY (All Calls View)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ⬅ Back          Call History          🔍 Search   📁 Filter       │
│                                                                     │
│  📊 Call Statistics (Last 7 Days)                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Total Calls: 47         Avg Duration: 4m 23s                  │ │
│  │ New Leads: 12           Conversions: 8 (67%)                  │ │
│  │ Follow-ups: 35          Missed: 2 (4%)                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🗂️ Filter: [All] [Incoming] [Outgoing] [Missed] [New Leads]      │
│                                                                     │
│  📞 Today (3 calls)                                                │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🟢 John Smith 🆕                             10:23 AM          │ │
│  │    +1-555-0123 • Incoming • 3m 42s                            │ │
│  │    → Property Viewing Scheduled                               │ │
│  │    [▶️] [📄 Transcript] [👤 Profile]                          │ │
│  │────────────────────────────────────────────────────────────── │ │
│  │ 🟢 Maria Garcia                              2:15 PM           │ │
│  │    +1-555-0456 • Outgoing • 6m 12s                            │ │
│  │    → Offer accepted, closing scheduled                        │ │
│  │    [▶️] [📄 Transcript] [👤 Profile]                          │ │
│  │────────────────────────────────────────────────────────────── │ │
│  │ 🔴 Unknown Caller (MISSED)                   4:45 PM           │ │
│  │    +1-555-0789 • Incoming • 0s                                │ │
│  │    [📞 Call Back] [💬 Text]                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  📞 Yesterday (8 calls)                                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🟢 Robert Lee                                9:00 AM           │ │
│  │    +1-555-0234 • Incoming • 8m 34s                            │ │
│  │    → Consultation request, appointment booked                 │ │
│  │    [▶️] [📄 Transcript] [👤 Profile]                          │ │
│  │────────────────────────────────────────────────────────────── │ │
│  │ 🟢 Sarah Chen 🆕                             11:30 AM          │ │
│  │    +1-555-0567 • Incoming • 5m 21s                            │ │
│  │    → Home inspection inquiry                                  │ │
│  │    [▶️] [📄 Transcript] [👤 Profile]                          │ │
│  │────────────────────────────────────────────────────────────── │ │
│  │ [View All 8 Calls] ▼                                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  📞 This Week (47 calls)                                           │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Mon: 12 calls (2 new leads)                                   │ │
│  │ Tue: 8 calls (1 new lead)                                     │ │
│  │ Wed: 9 calls (3 new leads)                                    │ │
│  │ Thu: 11 calls (4 new leads)                                   │ │
│  │ Fri: 7 calls (2 new leads)                                    │ │
│  │                                                                │ │
│  │ [View Weekly Report] [Export CSV]                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🔍 Quick Search:                                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Search by name, phone, or keywords...                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│ SCREEN 8: SETTINGS & PREFERENCES                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ⬅ Back          Settings                                          │
│                                                                     │
│  👤 Profile                                                         │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Sarah Johnson                                                 │ │
│  │ Real Estate Agent                                             │ │
│  │ License #: RE-12345678                                        │ │
│  │                                                                │ │
│  │ 📞 +1-555-AGENT-01                                            │ │
│  │ ✉️ sarah.johnson@realestate.ca                                 │ │
│  │                                                                │ │
│  │ [Edit Profile] [Change Photo]                                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  📞 Call Settings                                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Twilio Business Number: +1-555-REAL-ESTATE                    │ │
│  │ [Change Number] [Test Call]                                   │ │
│  │                                                                │ │
│  │ Auto-Answer: ◉ Enabled  ○ Disabled                            │ │
│  │ Call Recording: ☑ Always record (for AI transcription)        │ │
│  │ Voicemail: ☑ Enabled                                          │ │
│  │ Custom Greeting: [Record Greeting]                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🔔 Notification Preferences                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Push Notifications:                                           │ │
│  │ ☑ Incoming calls                                              │ │
│  │ ☑ New leads created                                           │ │
│  │ ☑ Task reminders (30 min before)                              │ │
│  │ ☑ Calendar event reminders                                    │ │
│  │ ☐ Daily performance summary                                   │ │
│  │                                                                │ │
│  │ SMS Notifications:                                            │ │
│  │ ☑ Missed calls                                                │ │
│  │ ☑ Customer replies                                            │ │
│  │ ☐ Weekly activity report                                      │ │
│  │                                                                │ │
│  │ Email Notifications:                                          │ │
│  │ ☑ Daily task summary (8:00 AM)                                │ │
│  │ ☑ New customer assignments                                    │ │
│  │ ☑ Appointment confirmations                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🤖 AI Assistant Settings                                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Auto-Create Leads: ◉ Enabled  ○ Review First                  │ │
│  │ Auto-Schedule Tasks: ◉ Enabled  ○ Manual Only                 │ │
│  │ Lead Scoring: ◉ AI-Powered  ○ Manual Scoring                  │ │
│  │ Smart Suggestions: ☑ Show during calls                        │ │
│  │ Property Matching: ☑ Auto-suggest based on preferences        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🏢 Territory & Availability                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Coverage Area: Downtown Toronto, Midtown                      │ │
│  │ [Edit Coverage Map]                                           │ │
│  │                                                                │ │
│  │ Working Hours:                                                │ │
│  │ Mon-Fri: 9:00 AM - 6:00 PM                                    │ │
│  │ Sat: 10:00 AM - 4:00 PM                                       │ │
│  │ Sun: Off                                                      │ │
│  │ [Edit Schedule]                                               │ │
│  │                                                                │ │
│  │ Call Routing: ◉ Route to me  ○ Round-robin  ○ Out of office  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🔐 Privacy & Security                                             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ [Change Password] [Enable 2FA] [Download Data] [Logout]      │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Customer Mobile App (Optional - Future Enhancement)

```
┌─────────────────────────────────────────────────────────────────────┐
│ SCREEN: Booking Confirmation (After Call)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ⬅ Back to Home                                                    │
│                                                                     │
│  ✅ Appointment Confirmed                                          │
│                                                                     │
│  Property Viewing                                                   │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 📅 Tuesday, November 15, 2025                                 │ │
│  │ 🕐 2:00 PM - 3:00 PM                                          │ │
│  │ 📍 123 Main Street, Toronto, ON                               │ │
│  │                                                                │ │
│  │ 👤 Your Agent: Sarah Johnson                                  │ │
│  │    ⭐⭐⭐⭐⭐ (4.9/5 - 127 reviews)                           │ │
│  │    📞 +1-555-AGENT-01                                         │ │
│  │    ✉️ sarah.johnson@realestate.ca                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  🔔 Reminders Set:                                                 │
│  ✓ 1 day before (Nov 14, 2pm)                                      │
│  ✓ 2 hours before (Nov 15, 12pm)                                   │
│                                                                     │
│  📧 Confirmation Sent To:                                          │
│  ✓ +1-555-0123 (SMS)                                               │
│  ✓ john@example.com (Email with calendar invite)                   │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐               │
│  │  Add to Calendar     │  │  Get Directions      │               │
│  └──────────────────────┘  └──────────────────────┘               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Need to Reschedule? Reply CANCEL to this number            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Platform Configuration

### 7.1 Entity Configuration (entityConfig.ts)

```typescript
// apps/web/src/lib/entityConfig.ts
import { EntityConfig } from '../types/entity';

export const realEstateEntities: EntityConfig[] = [
  {
    entityType: 'customer',
    label: 'Customer',
    pluralLabel: 'Customers',
    icon: 'Users',
    primaryField: 'name',

    columns: [
      {
        accessorKey: 'name',
        header: 'Customer Name',
        editable: true,
        fieldType: 'text'
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        editable: true,
        fieldType: 'tel'
      },
      {
        accessorKey: 'email',
        header: 'Email',
        editable: true,
        fieldType: 'email'
      },
      {
        accessorKey: 'customer_tier',
        header: 'Tier',
        editable: true,
        fieldType: 'select',
        loadOptionsFromSettings: 'customer_tier'
      },
      {
        accessorKey: 'acquisition_channel',
        header: 'Source',
        editable: true,
        fieldType: 'select',
        loadOptionsFromSettings: 'acquisition_channel'
      },
      {
        accessorKey: 'created_ts',
        header: 'Created',
        editable: false,
        fieldType: 'timestamp'
      }
    ],

    childEntities: [
      { entity: 'task', ui_icon: 'CheckSquare', ui_label: 'Tasks' },
      { entity: 'calendar', ui_icon: 'Calendar', ui_label: 'Appointments' },
      { entity: 'artifact', ui_icon: 'FileText', ui_label: 'Call Transcripts' }
    ]
  },

  {
    entityType: 'task',
    label: 'Task',
    pluralLabel: 'Tasks',
    icon: 'CheckSquare',
    primaryField: 'name',

    columns: [
      {
        accessorKey: 'name',
        header: 'Task Name',
        editable: true,
        fieldType: 'text'
      },
      {
        accessorKey: 'assignee_name',
        header: 'Assigned To',
        editable: true,
        fieldType: 'select',
        loadOptionsFromEntity: 'employee'
      },
      {
        accessorKey: 'status',
        header: 'Status',
        editable: true,
        fieldType: 'select',
        loadOptionsFromSettings: 'task_stage'
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        editable: true,
        fieldType: 'select',
        loadOptionsFromSettings: 'task_priority'
      },
      {
        accessorKey: 'due_date',
        header: 'Due Date',
        editable: true,
        fieldType: 'datetime'
      }
    ],

    childEntities: [
      { entity: 'calendar', ui_icon: 'Calendar', ui_label: 'Scheduled Time' }
    ]
  },

  {
    entityType: 'calendar',
    label: 'Calendar Event',
    pluralLabel: 'Calendar',
    icon: 'Calendar',
    primaryField: 'event_name',

    columns: [
      {
        accessorKey: 'event_name',
        header: 'Event',
        editable: true,
        fieldType: 'text'
      },
      {
        accessorKey: 'event_type',
        header: 'Type',
        editable: true,
        fieldType: 'select',
        loadOptionsFromSettings: 'event_type'
      },
      {
        accessorKey: 'start_time',
        header: 'Start',
        editable: true,
        fieldType: 'datetime'
      },
      {
        accessorKey: 'end_time',
        header: 'End',
        editable: true,
        fieldType: 'datetime'
      },
      {
        accessorKey: 'location',
        header: 'Location',
        editable: true,
        fieldType: 'text'
      },
      {
        accessorKey: 'attendees',
        header: 'Attendees',
        editable: true,
        fieldType: 'multiselect',
        loadOptionsFromEntity: 'employee,customer'
      }
    ]
  }
];
```

### 7.2 Settings Tables Configuration

```sql
-- Real Estate Specific Settings
-- Reference: docs/settings/settings.md

-- Customer Tiers
INSERT INTO app.setting_datalabel (datalabel, name, display_order, active_flag)
VALUES
('customer_tier', 'LEAD', 1, TRUE),
('customer_tier', 'PROSPECT', 2, TRUE),
('customer_tier', 'ACTIVE', 3, TRUE),
('customer_tier', 'VIP', 4, TRUE),
('customer_tier', 'INACTIVE', 5, TRUE);

-- Acquisition Channels
INSERT INTO app.setting_datalabel (datalabel, name, display_order, active_flag)
VALUES
('acquisition_channel', 'PHONE', 1, TRUE),
('acquisition_channel', 'WEB', 2, TRUE),
('acquisition_channel', 'REFERRAL', 3, TRUE),
('acquisition_channel', 'WALK_IN', 4, TRUE),
('acquisition_channel', 'SOCIAL_MEDIA', 5, TRUE);

-- Task Types (Real Estate Specific)
INSERT INTO app.setting_datalabel (datalabel, name, display_order, active_flag)
VALUES
('task_type', 'PROPERTY_VIEWING', 1, TRUE),
('task_type', 'HOME_INSPECTION', 2, TRUE),
('task_type', 'OFFER_SUBMISSION', 3, TRUE),
('task_type', 'DOCUMENT_SIGNING', 4, TRUE),
('task_type', 'FOLLOW_UP_CALL', 5, TRUE);

-- Event Types
INSERT INTO app.setting_datalabel (datalabel, name, display_order, active_flag)
VALUES
('event_type', 'PROPERTY_VIEWING', 1, TRUE),
('event_type', 'HOME_INSPECTION', 2, TRUE),
('event_type', 'CONSULTATION', 3, TRUE),
('event_type', 'CLOSING_MEETING', 4, TRUE);
```

### 7.3 AI Chat System Configuration

```typescript
// apps/api/src/modules/ai-chat/config/real-estate-tools.ts
// MCP Tools for Real Estate Domain

export const realEstateTools = [
  {
    name: 'create_customer',
    description: 'Creates a new customer/lead record from call conversation',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer full name' },
        phone: { type: 'string', description: 'Phone number' },
        email: { type: 'string', description: 'Email address (optional)' },
        customer_tier: {
          type: 'string',
          enum: ['LEAD', 'PROSPECT', 'ACTIVE', 'VIP'],
          description: 'Customer tier/status'
        },
        acquisition_channel: {
          type: 'string',
          enum: ['PHONE', 'WEB', 'REFERRAL', 'WALK_IN'],
          description: 'How customer found us'
        }
      },
      required: ['name', 'phone', 'customer_tier', 'acquisition_channel']
    }
  },

  {
    name: 'search_customers',
    description: 'Search for existing customer by phone or name',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'Phone number to search' },
        name: { type: 'string', description: 'Name to search (optional)' }
      },
      required: ['phone']
    }
  },

  {
    name: 'create_task',
    description: 'Creates a service task for an agent',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Task name' },
        customer_id: { type: 'string', description: 'Customer UUID' },
        assignee_id: { type: 'string', description: 'Agent UUID' },
        task_type: {
          type: 'string',
          enum: ['PROPERTY_VIEWING', 'HOME_INSPECTION', 'OFFER_SUBMISSION', 'FOLLOW_UP_CALL'],
          description: 'Type of task'
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          description: 'Task priority'
        },
        due_date: { type: 'string', format: 'date-time', description: 'When task is due' }
      },
      required: ['name', 'customer_id', 'assignee_id', 'task_type']
    }
  },

  {
    name: 'create_calendar_event',
    description: 'Books an appointment on calendar',
    parameters: {
      type: 'object',
      properties: {
        event_name: { type: 'string', description: 'Event title' },
        event_type: {
          type: 'string',
          enum: ['PROPERTY_VIEWING', 'HOME_INSPECTION', 'CONSULTATION', 'CLOSING_MEETING'],
          description: 'Type of appointment'
        },
        start_time: { type: 'string', format: 'date-time', description: 'Start date/time' },
        end_time: { type: 'string', format: 'date-time', description: 'End date/time' },
        location: { type: 'string', description: 'Property address or meeting location' },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'UUIDs of attendees (agent + customer)'
        }
      },
      required: ['event_name', 'event_type', 'start_time', 'attendees']
    }
  },

  {
    name: 'send_sms',
    description: 'Sends SMS notification to customer',
    parameters: {
      type: 'object',
      properties: {
        recipient_phone: { type: 'string', description: 'Customer phone number' },
        message: { type: 'string', description: 'SMS content' }
      },
      required: ['recipient_phone', 'message']
    }
  },

  {
    name: 'link_entities',
    description: 'Creates parent-child relationship between entities',
    parameters: {
      type: 'object',
      properties: {
        parent_type: {
          type: 'string',
          enum: ['CUSTOMER', 'TASK', 'CALENDAR'],
          description: 'Parent entity type'
        },
        parent_id: { type: 'string', description: 'Parent UUID' },
        child_type: {
          type: 'string',
          enum: ['CUSTOMER', 'TASK', 'CALENDAR'],
          description: 'Child entity type'
        },
        child_id: { type: 'string', description: 'Child UUID' }
      },
      required: ['parent_type', 'parent_id', 'child_type', 'child_id']
    }
  }
];
```

### 7.4 Environment Variables

```bash
# .env.production
# Real Estate Call-to-Lead System Configuration

# Twilio Voice Integration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567

# AI Services
DEEPGRAM_API_KEY=your_deepgram_key_here
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# Notifications
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@realestate.ca
FCM_SERVER_KEY=your_firebase_server_key_here

# Platform API
API_URL=https://api.realestate.ca
API_VERSION=v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pmo
```

---

## 8. API Testing & Integration Examples

This section provides complete API endpoint examples for testing and integrating with the Real Estate Call-to-Lead system using the platform's tooling.

### 8.1 Testing with Platform Tools

**Use `/home/rabin/projects/pmo/tools/test-api.sh` for all API testing** - it handles authentication automatically.

```bash
# Test script usage:
# ./tools/test-api.sh METHOD PATH [JSON_BODY]

# Examples:
./tools/test-api.sh GET /api/v1/customer
./tools/test-api.sh POST /api/v1/customer '{"name":"John Smith"}'
./tools/test-api.sh PUT /api/v1/customer/uuid-123 '{"status":"ACTIVE"}'
./tools/test-api.sh DELETE /api/v1/customer/uuid-123
```

### 8.2 Customer Management Endpoints

#### Create Customer (New Lead from Call)

```bash
# Create customer with full details extracted from call
./tools/test-api.sh POST /api/v1/customer '{
  "name": "John Smith",
  "phone": "+1-555-0123",
  "email": "john@example.com",
  "customer_tier": "LEAD",
  "acquisition_channel": "PHONE",
  "tags": ["first-time-buyer", "condo-interest", "downtown"],
  "metadata": {
    "budget_min": 500000,
    "budget_max": 600000,
    "property_type": "Condo",
    "bedrooms": 2,
    "location_preference": "Downtown Toronto"
  }
}'

# Response:
{
  "id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
  "name": "John Smith",
  "phone": "+1-555-0123",
  "email": "john@example.com",
  "customer_tier": "LEAD",
  "acquisition_channel": "PHONE",
  "tags": ["first-time-buyer", "condo-interest", "downtown"],
  "metadata": {...},
  "created_ts": "2025-11-12T10:27:00Z",
  "active_flag": true
}
```

#### Search for Existing Customer

```bash
# Search by phone (used during call to check if customer exists)
./tools/test-api.sh GET '/api/v1/customer?phone=%2B1-555-0123'

# Search by name
./tools/test-api.sh GET '/api/v1/customer?name=John%20Smith'

# Search with filters
./tools/test-api.sh GET '/api/v1/customer?customer_tier=LEAD&acquisition_channel=PHONE&limit=20'

# Response:
{
  "data": [
    {
      "id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "name": "John Smith",
      "phone": "+1-555-0123",
      "customer_tier": "LEAD",
      "created_ts": "2025-11-12T10:27:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

#### Update Customer (Convert Lead to Client)

```bash
# Update customer tier when lead converts
./tools/test-api.sh PUT /api/v1/customer/8260b1b0-5efc-4611-ad33-ee76c0cf7f13 '{
  "customer_tier": "ACTIVE",
  "tags": ["first-time-buyer", "condo-interest", "downtown", "converted"]
}'
```

#### Get Customer with Relationships

```bash
# Get customer with all linked tasks, calls, and appointments
./tools/test-api.sh GET '/api/v1/customer/8260b1b0-5efc-4611-ad33-ee76c0cf7f13?include=tasks,calendar,artifacts'

# Response includes child entities:
{
  "id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
  "name": "John Smith",
  "phone": "+1-555-0123",
  "customer_tier": "LEAD",
  "tasks": [
    {
      "id": "task-uuid-1",
      "name": "Property Viewing",
      "status": "PENDING",
      "due_date": "2025-11-15T14:00:00Z"
    }
  ],
  "calendar_events": [
    {
      "id": "event-uuid-1",
      "event_name": "Property Viewing - John Smith",
      "start_time": "2025-11-15T14:00:00Z"
    }
  ],
  "call_transcripts": [
    {
      "id": "artifact-uuid-1",
      "artifact_type": "TRANSCRIPT",
      "created_ts": "2025-11-12T10:23:00Z",
      "s3_url": "https://s3.../call-transcript.mp3"
    }
  ]
}
```

### 8.3 Task Management Endpoints

#### Create Task (Service Request)

```bash
# Create task linked to customer
./tools/test-api.sh POST /api/v1/task '{
  "name": "Property Viewing - 123 Main Street",
  "description": "Show 2-bedroom condo to John Smith. Budget: $500k-$600k.",
  "assignee_id": "agent-uuid-sarah-johnson",
  "status": "PENDING",
  "priority": "HIGH",
  "task_type": "PROPERTY_VIEWING",
  "due_date": "2025-11-15T14:00:00Z",
  "metadata": {
    "property_address": "123 Main Street, Toronto, ON",
    "customer_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
    "estimated_duration": 60
  }
}'

# Response:
{
  "id": "task-uuid-1",
  "name": "Property Viewing - 123 Main Street",
  "assignee_id": "agent-uuid-sarah-johnson",
  "status": "PENDING",
  "priority": "HIGH",
  "created_ts": "2025-11-12T10:27:00Z"
}
```

#### Link Task to Customer (Parent-Child Relationship)

```bash
# Create linkage in d_entity_instance_link
./tools/test-api.sh POST /api/v1/entity-linkage '{
  "parent_entity_type": "CUSTOMER",
  "parent_entity_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
  "child_entity_type": "TASK",
  "child_entity_id": "task-uuid-1"
}'
```

#### Get Agent Tasks (Filtered by Assignee)

```bash
# Get all tasks assigned to agent
./tools/test-api.sh GET '/api/v1/task?assignee_id=agent-uuid-sarah-johnson&status=PENDING&sort=-priority'

# Get tasks due today
./tools/test-api.sh GET '/api/v1/task?assignee_id=agent-uuid-sarah-johnson&due_date_start=2025-11-12T00:00:00Z&due_date_end=2025-11-12T23:59:59Z'
```

#### Update Task Status

```bash
# Mark task as in progress
./tools/test-api.sh PUT /api/v1/task/task-uuid-1 '{
  "status": "IN_PROGRESS"
}'

# Complete task
./tools/test-api.sh PUT /api/v1/task/task-uuid-1 '{
  "status": "COMPLETED",
  "completion_notes": "Property viewing completed. Customer very interested, requesting second visit."
}'
```

### 8.4 Calendar Event Endpoints

#### Create Calendar Event (Appointment Booking)

```bash
# Create calendar event for property viewing
./tools/test-api.sh POST /api/v1/calendar '{
  "event_name": "Property Viewing - John Smith",
  "event_type": "PROPERTY_VIEWING",
  "start_time": "2025-11-15T14:00:00Z",
  "end_time": "2025-11-15T15:00:00Z",
  "location": "123 Main Street, Toronto, ON M5V 2T6",
  "created_by": "agent-uuid-sarah-johnson",
  "metadata": {
    "customer_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
    "task_id": "task-uuid-1",
    "property_id": "property-uuid-123"
  }
}'

# Response:
{
  "id": "event-uuid-1",
  "event_name": "Property Viewing - John Smith",
  "start_time": "2025-11-15T14:00:00Z",
  "end_time": "2025-11-15T15:00:00Z",
  "created_ts": "2025-11-12T10:27:00Z"
}
```

#### Add Event Attendees

```bash
# Add customer as attendee
./tools/test-api.sh POST /api/v1/calendar/event-uuid-1/attendees '{
  "person_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
  "person_type": "CUSTOMER",
  "rsvp_status": "PENDING"
}'

# Add agent as attendee
./tools/test-api.sh POST /api/v1/calendar/event-uuid-1/attendees '{
  "person_id": "agent-uuid-sarah-johnson",
  "person_type": "AGENT",
  "rsvp_status": "ACCEPTED"
}'
```

#### Check Agent Availability

```bash
# Check availability for time slot
./tools/test-api.sh GET '/api/v1/calendar/availability?agent_id=agent-uuid-sarah-johnson&date=2025-11-15&start_time=14:00&end_time=15:00'

# Response:
{
  "available": true,
  "conflicts": [],
  "suggested_times": []
}

# If not available:
{
  "available": false,
  "conflicts": [
    {
      "event_name": "Home Inspection - Maria Garcia",
      "start_time": "2025-11-15T14:30:00Z",
      "end_time": "2025-11-15T15:30:00Z"
    }
  ],
  "suggested_times": [
    "2025-11-15T16:00:00Z",
    "2025-11-15T17:00:00Z",
    "2025-11-16T14:00:00Z"
  ]
}
```

#### Reschedule Event

```bash
# Update event time
./tools/test-api.sh PUT /api/v1/calendar/event-uuid-1 '{
  "start_time": "2025-11-15T16:00:00Z",
  "end_time": "2025-11-15T17:00:00Z"
}'
```

### 8.5 AI Chat & Voice Call Endpoints

#### Start Voice Call Session

```bash
# Initiate voice call (triggered by Twilio webhook)
./tools/test-api.sh POST /api/v1/ai-chat/voice/start '{
  "caller_phone": "+1-555-0123",
  "agent_id": "agent-uuid-sarah-johnson",
  "twilio_call_sid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}'

# Response:
{
  "session_id": "call-session-uuid",
  "websocket_url": "wss://api.realestate.ca/ai-chat/voice/stream/call-session-uuid",
  "status": "connected"
}
```

#### Get Call Transcript

```bash
# Retrieve transcript after call ends
./tools/test-api.sh GET /api/v1/ai-chat/session/call-session-uuid/transcript

# Response:
{
  "session_id": "call-session-uuid",
  "duration": 222,
  "transcript": [
    {
      "speaker": "CUSTOMER",
      "timestamp": "2025-11-12T10:23:15Z",
      "text": "Hi, I'm interested in viewing the property at 123 Main Street."
    },
    {
      "speaker": "AGENT",
      "timestamp": "2025-11-12T10:23:22Z",
      "text": "Hi! Let me check my calendar. Are you available this Tuesday around 2pm?"
    },
    {
      "speaker": "CUSTOMER",
      "timestamp": "2025-11-12T10:23:28Z",
      "text": "Yes, that works perfectly for me."
    }
  ],
  "ai_analysis": {
    "intent": "PROPERTY_VIEWING",
    "customer_name": "John Smith",
    "extracted_data": {
      "property_address": "123 Main Street",
      "preferred_date": "Tuesday",
      "preferred_time": "2pm"
    }
  },
  "audio_url": "https://s3.../call-recording-call-session-uuid.mp3"
}
```

#### Execute MCP Tool Manually

```bash
# Test MCP tool execution (for debugging)
./tools/test-api.sh POST /api/v1/ai-chat/tools/execute '{
  "tool": "create_customer",
  "params": {
    "name": "John Smith",
    "phone": "+1-555-0123",
    "customer_tier": "LEAD",
    "acquisition_channel": "PHONE"
  }
}'

# Response:
{
  "success": true,
  "tool": "create_customer",
  "result": {
    "customer_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
    "created": true
  }
}
```

### 8.6 Notification Endpoints

#### Send SMS Notification

```bash
# Send booking confirmation SMS
./tools/test-api.sh POST /api/v1/notification/sms '{
  "recipient_phone": "+1-555-0123",
  "message": "Hi John! Your property viewing is confirmed for Tuesday, Nov 15 at 2:00 PM. Address: 123 Main Street. Reply CANCEL to reschedule."
}'

# Response:
{
  "message_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "status": "sent",
  "to": "+1-555-0123"
}
```

#### Send Push Notification

```bash
# Send task assignment notification to agent
./tools/test-api.sh POST /api/v1/notification/push '{
  "recipient_id": "agent-uuid-sarah-johnson",
  "title": "New Task Assigned",
  "body": "Property Viewing - John Smith\nDue: Tue, Nov 15 at 2:00 PM\n123 Main Street",
  "data": {
    "task_id": "task-uuid-1",
    "customer_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
    "action": "VIEW_TASK"
  }
}'
```

#### Send Email with Calendar Invite

```bash
# Send .ics calendar invite
./tools/test-api.sh POST /api/v1/notification/email '{
  "recipient_email": "john@example.com",
  "subject": "Property Viewing Appointment - Nov 15",
  "body_html": "<p>Your property viewing is confirmed...</p>",
  "attachments": [
    {
      "filename": "appointment.ics",
      "content_type": "text/calendar",
      "content": "BEGIN:VCALENDAR..."
    }
  ]
}'
```

### 8.7 Settings & Options Endpoints

#### Get Entity Options (Dropdowns)

```bash
# Get customer tier options
./tools/test-api.sh GET /api/v1/entity/customer/options

# Response:
{
  "customer_tier": [
    {"value": "LEAD", "label": "Lead", "display_order": 1},
    {"value": "PROSPECT", "label": "Prospect", "display_order": 2},
    {"value": "ACTIVE", "label": "Active Client", "display_order": 3},
    {"value": "VIP", "label": "VIP Client", "display_order": 4}
  ],
  "acquisition_channel": [
    {"value": "PHONE", "label": "Phone Call", "display_order": 1},
    {"value": "WEB", "label": "Website", "display_order": 2},
    {"value": "REFERRAL", "label": "Referral", "display_order": 3},
    {"value": "WALK_IN", "label": "Walk-in", "display_order": 4}
  ]
}

# Get task type options
./tools/test-api.sh GET /api/v1/entity/task/options

# Response:
{
  "task_type": [
    {"value": "PROPERTY_VIEWING", "label": "Property Viewing"},
    {"value": "HOME_INSPECTION", "label": "Home Inspection"},
    {"value": "OFFER_SUBMISSION", "label": "Offer Submission"},
    {"value": "FOLLOW_UP_CALL", "label": "Follow-up Call"}
  ],
  "priority": [
    {"value": "LOW", "label": "Low"},
    {"value": "MEDIUM", "label": "Medium"},
    {"value": "HIGH", "label": "High"},
    {"value": "URGENT", "label": "Urgent"}
  ]
}
```

### 8.8 Complete End-to-End Test Script

```bash
#!/bin/bash
# Real Estate Call-to-Lead System - End-to-End Test
# Location: /home/rabin/projects/pmo/tools/test-real-estate-flow.sh

set -e  # Exit on error

echo "🏡 Real Estate Call-to-Lead System - E2E Test"
echo "=============================================="

# 1. Search for existing customer
echo ""
echo "1️⃣ Searching for existing customer..."
CUSTOMER_SEARCH=$(./tools/test-api.sh GET '/api/v1/customer?phone=%2B1-555-0123')
CUSTOMER_ID=$(echo $CUSTOMER_SEARCH | jq -r '.data[0].id // empty')

if [ -z "$CUSTOMER_ID" ]; then
  echo "   Customer not found. Creating new lead..."

  # 2. Create new customer
  CUSTOMER_RESPONSE=$(./tools/test-api.sh POST /api/v1/customer '{
    "name": "John Smith",
    "phone": "+1-555-0123",
    "email": "john@example.com",
    "customer_tier": "LEAD",
    "acquisition_channel": "PHONE"
  }')
  CUSTOMER_ID=$(echo $CUSTOMER_RESPONSE | jq -r '.id')
  echo "   ✅ Customer created: $CUSTOMER_ID"
else
  echo "   ✅ Existing customer found: $CUSTOMER_ID"
fi

# 3. Create task
echo ""
echo "2️⃣ Creating property viewing task..."
TASK_RESPONSE=$(./tools/test-api.sh POST /api/v1/task '{
  "name": "Property Viewing - 123 Main Street",
  "assignee_id": "agent-uuid-sarah-johnson",
  "status": "PENDING",
  "priority": "HIGH",
  "task_type": "PROPERTY_VIEWING",
  "due_date": "2025-11-15T14:00:00Z"
}')
TASK_ID=$(echo $TASK_RESPONSE | jq -r '.id')
echo "   ✅ Task created: $TASK_ID"

# 4. Create calendar event
echo ""
echo "3️⃣ Booking calendar appointment..."
EVENT_RESPONSE=$(./tools/test-api.sh POST /api/v1/calendar '{
  "event_name": "Property Viewing - John Smith",
  "event_type": "PROPERTY_VIEWING",
  "start_time": "2025-11-15T14:00:00Z",
  "end_time": "2025-11-15T15:00:00Z",
  "location": "123 Main Street, Toronto, ON"
}')
EVENT_ID=$(echo $EVENT_RESPONSE | jq -r '.id')
echo "   ✅ Calendar event created: $EVENT_ID"

# 5. Link entities
echo ""
echo "4️⃣ Creating entity linkages..."
./tools/test-api.sh POST /api/v1/entity-linkage '{
  "parent_entity_type": "CUSTOMER",
  "parent_entity_id": "'$CUSTOMER_ID'",
  "child_entity_type": "TASK",
  "child_entity_id": "'$TASK_ID'"
}' > /dev/null
echo "   ✅ Customer ↔ Task linked"

./tools/test-api.sh POST /api/v1/entity-linkage '{
  "parent_entity_type": "TASK",
  "parent_entity_id": "'$TASK_ID'",
  "child_entity_type": "CALENDAR",
  "child_entity_id": "'$EVENT_ID'"
}' > /dev/null
echo "   ✅ Task ↔ Calendar linked"

# 6. Send notifications
echo ""
echo "5️⃣ Sending notifications..."
./tools/test-api.sh POST /api/v1/notification/sms '{
  "recipient_phone": "+1-555-0123",
  "message": "Hi John! Your property viewing is confirmed for Tuesday, Nov 15 at 2:00 PM. Address: 123 Main Street."
}' > /dev/null
echo "   ✅ SMS sent to customer"

./tools/test-api.sh POST /api/v1/notification/push '{
  "recipient_id": "agent-uuid-sarah-johnson",
  "title": "New Task Assigned",
  "body": "Property Viewing - John Smith"
}' > /dev/null
echo "   ✅ Push notification sent to agent"

# 7. Verify data
echo ""
echo "6️⃣ Verifying created data..."
./tools/test-api.sh GET "/api/v1/customer/$CUSTOMER_ID?include=tasks,calendar" | jq .
echo "   ✅ Data verification complete"

echo ""
echo "✅ End-to-End Test Completed Successfully!"
echo "   Customer ID: $CUSTOMER_ID"
echo "   Task ID: $TASK_ID"
echo "   Event ID: $EVENT_ID"
```

### 8.9 Error Handling Examples

#### Customer Not Found

```bash
./tools/test-api.sh GET /api/v1/customer/invalid-uuid

# Response (404):
{
  "error": "Customer not found",
  "code": "CUSTOMER_NOT_FOUND",
  "status": 404
}
```

#### Validation Error

```bash
# Missing required field
./tools/test-api.sh POST /api/v1/customer '{
  "name": "John Smith"
}'

# Response (400):
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "status": 400,
  "details": {
    "phone": "Phone number is required",
    "customer_tier": "Customer tier is required",
    "acquisition_channel": "Acquisition channel is required"
  }
}
```

#### RBAC Permission Denied

```bash
# Attempting to access customer without permission
./tools/test-api.sh GET /api/v1/customer/other-agent-customer-uuid

# Response (403):
{
  "error": "Permission denied",
  "code": "RBAC_PERMISSION_DENIED",
  "status": 403,
  "message": "You do not have view permission for this customer"
}
```

---

## 9. Success Metrics & KPIs

### 8.1 Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Lead Capture Rate** | 100% | All calls → customer records |
| **Data Entry Time Saved** | 5 min/call | Manual entry elimination |
| **Task Creation Speed** | <10 sec | Post-call automation |
| **Notification Delivery** | >99% | SMS/Push/Email success rate |
| **Customer Response Time** | <2 min | Call end → confirmation received |
| **Agent Adoption Rate** | >90% | % of calls using system vs manual |

### 8.2 Technical Metrics

| Metric | Target | Monitoring |
|--------|--------|-----------|
| **Transcription Accuracy** | >95% | Deepgram confidence score |
| **LLM Intent Detection** | >90% | Manual audit sample |
| **Data Extraction Accuracy** | >85% | Name, phone, address correctness |
| **API Latency** | <500ms | Entity creation response time |
| **WebSocket Uptime** | >99.9% | Voice call connection stability |
| **Notification Delivery** | >99% | SMS/Push/Email delivery confirmation |

---

## 9. Future Enhancements

### Phase 2: Advanced Features
- **Multi-language support** (French, Mandarin, Spanish)
- **Sentiment analysis** (detect customer frustration, urgency)
- **Property matching AI** (recommend properties based on conversation)
- **Automated follow-up sequences** (drip campaigns, nurture emails)
- **Integration with MLS listings** (real-time property availability)

### Phase 3: Analytics & Insights
- **Call quality scoring** (agent performance metrics)
- **Lead conversion prediction** (ML-based scoring)
- **Revenue forecasting** (pipeline analytics)
- **Customer intent clustering** (categorize request patterns)
- **Territory optimization** (agent workload balancing)

---

## 10. Deployment Guide

This section provides step-by-step instructions for deploying the Real Estate Call-to-Lead system to production.

### 10.1 Prerequisites

**Required Accounts & Services:**
- [ ] Twilio account with voice capabilities (+1 phone number)
- [ ] Deepgram API account (speech-to-text)
- [ ] OpenAI API account (GPT-4o mini access)
- [ ] ElevenLabs API account (text-to-speech)
- [ ] AWS account (SES for email, S3 for storage, optional EC2 for hosting)
- [ ] Firebase account (Cloud Messaging for push notifications)
- [ ] Domain name for production deployment (e.g., `realestate.ca`)
- [ ] SSL certificate (Let's Encrypt or AWS Certificate Manager)

**Local Development Requirements:**
```bash
# Verify node.js and pnpm installed
node --version  # v20.x or higher
pnpm --version  # v8.x or higher

# Verify Docker installed (for database)
docker --version  # 20.x or higher
```

### 10.2 Database Setup

#### Step 1: Initialize Database Schema

```bash
# Navigate to project root
cd /home/rabin/projects/pmo

# Start PostgreSQL via Docker
docker run -d \
  --name pmo-postgres \
  -e POSTGRES_USER=app \
  -e POSTGRES_PASSWORD=app \
  -e POSTGRES_DB=app \
  -p 5434:5432 \
  postgres:14

# Import all database schemas (46 DDL files, 50 tables)
./tools/db-import.sh

# Verify schema creation
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c "\dt app.*" | grep -E "(d_customer|d_task|d_entity_person_calendar)"
```

#### Step 2: Add Real Estate Settings Data

```bash
# Create settings data file
cat > /tmp/real-estate-settings.sql << 'EOF'
-- Customer Tiers
INSERT INTO app.setting_datalabel (datalabel, name, display_order, active_flag)
VALUES
('customer_tier', 'LEAD', 1, TRUE),
('customer_tier', 'PROSPECT', 2, TRUE),
('customer_tier', 'ACTIVE', 3, TRUE),
('customer_tier', 'VIP', 4, TRUE);

-- Acquisition Channels
INSERT INTO app.setting_datalabel (datalabel, name, display_order, active_flag)
VALUES
('acquisition_channel', 'PHONE', 1, TRUE),
('acquisition_channel', 'WEB', 2, TRUE),
('acquisition_channel', 'REFERRAL', 3, TRUE),
('acquisition_channel', 'WALK_IN', 4, TRUE);

-- Task Types (Real Estate Specific)
INSERT INTO app.setting_datalabel (datalabel, name, display_order, active_flag)
VALUES
('task_type', 'PROPERTY_VIEWING', 1, TRUE),
('task_type', 'HOME_INSPECTION', 2, TRUE),
('task_type', 'OFFER_SUBMISSION', 3, TRUE),
('task_type', 'FOLLOW_UP_CALL', 4, TRUE);

-- Event Types
INSERT INTO app.setting_datalabel (datalabel, name, display_order, active_flag)
VALUES
('event_type', 'PROPERTY_VIEWING', 1, TRUE),
('event_type', 'HOME_INSPECTION', 2, TRUE),
('event_type', 'CONSULTATION', 3, TRUE),
('event_type', 'CLOSING_MEETING', 4, TRUE);
EOF

# Import settings
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -f /tmp/real-estate-settings.sql
```

#### Step 3: Create Test Agent Account

```bash
# Create real estate agent user
cat > /tmp/create-agent.sql << 'EOF'
INSERT INTO app.d_employee (id, name, email, phone, position_id, active_flag)
VALUES
(
  '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
  'Sarah Johnson',
  'sarah.johnson@realestate.ca',
  '+1-555-AGENT-01',
  (SELECT id FROM app.position WHERE name = 'Agent' LIMIT 1),
  TRUE
);

-- Grant full platform permissions
INSERT INTO app.d_entity_rbac (entity_type, entity_id, permission_user_id, permission)
VALUES
('ALL', 'all', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
 '{"0": true, "1": true, "2": true, "3": true, "4": true, "5": true}'::jsonb);
EOF

PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -f /tmp/create-agent.sql
```

### 10.3 Third-Party Service Configuration

#### Twilio Setup

```bash
# 1. Sign up at https://www.twilio.com
# 2. Purchase a phone number with Voice capabilities
# 3. Get credentials:
#    - Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#    - Auth Token: your_auth_token_here
# 4. Configure Webhook for incoming calls

# Set webhook in Twilio console:
# Voice & Fax > Configure > "A CALL COMES IN" webhook:
# https://api.realestate.ca/api/v1/ai-chat/voice/incoming
# Method: HTTP POST
```

#### Deepgram Setup

```bash
# 1. Sign up at https://deepgram.com
# 2. Create API key: Settings > API Keys > Create Key
# 3. Copy key: your_deepgram_key_here
# 4. Test API access:

curl -X POST 'https://api.deepgram.com/v1/listen' \
  -H 'Authorization: Token your_deepgram_key_here' \
  -H 'Content-Type: audio/wav' \
  --data-binary @test-audio.wav
```

#### OpenAI Setup

```bash
# 1. Sign up at https://platform.openai.com
# 2. Create API key: API Keys > Create new secret key
# 3. Copy key: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# 4. Verify GPT-4o mini access:

curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Test"}]
  }'
```

#### ElevenLabs Setup

```bash
# 1. Sign up at https://elevenlabs.io
# 2. Get API key: Profile > API Key
# 3. Test text-to-speech:

curl -X POST 'https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID' \
  -H 'xi-api-key: your_elevenlabs_key_here' \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Hello, this is a test.",
    "model_id": "eleven_monolingual_v1"
  }' \
  --output test-audio.mp3
```

#### AWS SES Setup

```bash
# 1. Log into AWS Console
# 2. Navigate to SES service
# 3. Verify email domain (realestate.ca)
# 4. Create SMTP credentials
# 5. Move out of sandbox mode (for production):

aws ses put-account-sending-enabled --enabled

# Test email sending:
aws ses send-email \
  --from noreply@realestate.ca \
  --destination ToAddresses=test@example.com \
  --message Subject={Data="Test"},Body={Text={Data="Test email"}}
```

#### Firebase Cloud Messaging Setup

```bash
# 1. Create Firebase project at https://console.firebase.google.com
# 2. Enable Cloud Messaging
# 3. Download service account key (JSON file)
# 4. Get Server Key from Project Settings > Cloud Messaging
# 5. Test push notification:

curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "DEVICE_TOKEN",
    "notification": {
      "title": "Test",
      "body": "Test notification"
    }
  }'
```

### 10.4 Backend Deployment

#### Step 1: Configure Environment Variables

```bash
# Create production .env file
cat > /home/rabin/projects/pmo/apps/api/.env.production << 'EOF'
# Database
DATABASE_URL=postgresql://app:SECURE_PASSWORD@db.realestate.ca:5432/pmo

# API Configuration
NODE_ENV=production
API_PORT=4000
API_URL=https://api.realestate.ca
JWT_SECRET=GENERATE_SECURE_RANDOM_STRING_HERE

# Twilio Voice Integration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567

# AI Services
DEEPGRAM_API_KEY=your_deepgram_key_here
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# AWS Services
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_SES_FROM_EMAIL=noreply@realestate.ca
AWS_S3_BUCKET=realestate-call-recordings

# Firebase
FCM_SERVER_KEY=your_firebase_server_key_here
FCM_SERVICE_ACCOUNT_PATH=/path/to/firebase-adminsdk.json

# Logging
LOG_LEVEL=info
EOF

# Generate secure JWT secret
openssl rand -base64 64
```

#### Step 2: Build and Deploy API

```bash
# Navigate to API directory
cd /home/rabin/projects/pmo/apps/api

# Install dependencies
pnpm install --prod

# Build TypeScript
pnpm run build

# Test production build locally
NODE_ENV=production node dist/index.js

# Deploy to production server (EC2, Docker, etc.)
# Option A: Direct EC2 deployment
scp -r dist node_modules .env.production ubuntu@api.realestate.ca:/opt/pmo-api/

ssh ubuntu@api.realestate.ca << 'ENDSSH'
cd /opt/pmo-api
pm2 start dist/index.js --name pmo-api-production
pm2 save
ENDSSH

# Option B: Docker deployment
docker build -t pmo-api:latest .
docker push registry.realestate.ca/pmo-api:latest

# On production server:
docker run -d \
  --name pmo-api \
  --env-file .env.production \
  -p 4000:4000 \
  --restart unless-stopped \
  registry.realestate.ca/pmo-api:latest
```

#### Step 3: Configure Reverse Proxy (Nginx)

```bash
# Install Nginx on production server
sudo apt-get install nginx certbot python3-certbot-nginx

# Create Nginx config for API
sudo tee /etc/nginx/sites-available/pmo-api << 'EOF'
server {
    listen 80;
    server_name api.realestate.ca;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.realestate.ca;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/api.realestate.ca/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.realestate.ca/privkey.pem;

    # API proxy
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support for voice calls
    location /api/v1/ai-chat/voice/stream {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF

# Enable site and obtain SSL certificate
sudo ln -s /etc/nginx/sites-available/pmo-api /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.realestate.ca
sudo systemctl reload nginx
```

### 10.5 Frontend Deployment (Mobile App)

#### React Native Mobile App Deployment

```bash
# Navigate to mobile app directory (hypothetical - would need to create)
cd /home/rabin/projects/pmo/apps/mobile

# Configure API URL
cat > .env.production << 'EOF'
API_URL=https://api.realestate.ca
WS_URL=wss://api.realestate.ca
FCM_SENDER_ID=your_firebase_sender_id
EOF

# Build for iOS
npx react-native run-ios --configuration Release

# Build for Android
cd android
./gradlew assembleRelease
# APK output: android/app/build/outputs/apk/release/app-release.apk

# Submit to App Stores
# iOS: Upload to App Store Connect via Xcode
# Android: Upload to Google Play Console
```

### 10.6 Monitoring & Health Checks

#### API Health Check Endpoint

```bash
# Test API health
curl https://api.realestate.ca/health

# Expected response:
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "connected",
    "twilio": "configured",
    "deepgram": "configured",
    "openai": "configured"
  },
  "uptime": 86400
}
```

#### Set Up Monitoring

```bash
# Install PM2 monitoring (if using PM2)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7

# Set up CloudWatch alarms (AWS)
aws cloudwatch put-metric-alarm \
  --alarm-name pmo-api-high-error-rate \
  --alarm-description "Alert when API error rate > 5%" \
  --metric-name Errors \
  --namespace AWS/ApiGateway \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:pmo-alerts

# Set up uptime monitoring (e.g., UptimeRobot)
# Monitor endpoints:
# - https://api.realestate.ca/health (every 5 minutes)
# - https://api.realestate.ca/api/v1/customer (authenticated check)
```

### 10.7 Testing Production Deployment

#### Smoke Test Script

```bash
#!/bin/bash
# Real Estate System Production Smoke Test
# Location: /home/rabin/projects/pmo/tools/test-production.sh

set -e

API_URL="https://api.realestate.ca"
AGENT_EMAIL="sarah.johnson@realestate.ca"
AGENT_PASSWORD="SECURE_PASSWORD"

echo "🔍 Running Production Smoke Tests..."

# 1. Health check
echo "1️⃣ Testing API health endpoint..."
curl -sf $API_URL/health | jq .status
echo "   ✅ API is healthy"

# 2. Authentication
echo "2️⃣ Testing authentication..."
AUTH_RESPONSE=$(curl -sf -X POST $API_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$AGENT_EMAIL\",\"password\":\"$AGENT_PASSWORD\"}")
TOKEN=$(echo $AUTH_RESPONSE | jq -r .token)
echo "   ✅ Authentication successful"

# 3. Test customer creation
echo "3️⃣ Testing customer creation..."
CUSTOMER=$(curl -sf -X POST $API_URL/api/v1/customer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "phone": "+1-555-TEST-01",
    "customer_tier": "LEAD",
    "acquisition_channel": "PHONE"
  }')
CUSTOMER_ID=$(echo $CUSTOMER | jq -r .id)
echo "   ✅ Customer created: $CUSTOMER_ID"

# 4. Test task creation
echo "4️⃣ Testing task creation..."
TASK=$(curl -sf -X POST $API_URL/api/v1/task \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Task\",
    \"assignee_id\": \"8260b1b0-5efc-4611-ad33-ee76c0cf7f13\",
    \"status\": \"PENDING\",
    \"priority\": \"HIGH\"
  }")
TASK_ID=$(echo $TASK | jq -r .id)
echo "   ✅ Task created: $TASK_ID"

# 5. Test calendar event
echo "5️⃣ Testing calendar event creation..."
EVENT=$(curl -sf -X POST $API_URL/api/v1/calendar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"event_name\": \"Test Event\",
    \"event_type\": \"CONSULTATION\",
    \"start_time\": \"2025-12-01T14:00:00Z\",
    \"end_time\": \"2025-12-01T15:00:00Z\"
  }")
EVENT_ID=$(echo $EVENT | jq -r .id)
echo "   ✅ Calendar event created: $EVENT_ID"

# 6. Test Twilio webhook (if configured)
echo "6️⃣ Testing Twilio voice webhook..."
curl -sf -X POST $API_URL/api/v1/ai-chat/voice/incoming \
  -d "From=+15551234567&CallSid=CAtest" \
  > /dev/null
echo "   ✅ Twilio webhook responding"

# 7. Clean up test data
echo "7️⃣ Cleaning up test data..."
curl -sf -X DELETE $API_URL/api/v1/customer/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN" > /dev/null
curl -sf -X DELETE $API_URL/api/v1/task/$TASK_ID \
  -H "Authorization: Bearer $TOKEN" > /dev/null
curl -sf -X DELETE $API_URL/api/v1/calendar/$EVENT_ID \
  -H "Authorization: Bearer $TOKEN" > /dev/null
echo "   ✅ Test data cleaned up"

echo ""
echo "✅ All Production Smoke Tests Passed!"
```

### 10.8 Backup & Disaster Recovery

```bash
# Database backup script
cat > /opt/scripts/backup-pmo-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/pmo"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pmo_db_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Dump database
PGPASSWORD='app' pg_dump -h localhost -U app -d app \
  | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://realestate-backups/database/

# Retain only last 7 days of local backups
find $BACKUP_DIR -name "pmo_db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x /opt/scripts/backup-pmo-db.sh

# Schedule daily backups via cron
echo "0 2 * * * /opt/scripts/backup-pmo-db.sh" | crontab -
```

### 10.9 Production Checklist

**Before Go-Live:**
- [ ] All third-party API keys configured and tested
- [ ] SSL certificates installed and auto-renewal configured
- [ ] Database backups automated and tested
- [ ] Monitoring and alerting configured
- [ ] RBAC permissions verified for all agents
- [ ] Settings data imported (customer tiers, task types, etc.)
- [ ] Test agent account created
- [ ] Twilio webhook configured and tested
- [ ] Mobile app submitted to App Stores (iOS, Android)
- [ ] Load testing completed (100+ concurrent calls)
- [ ] Security audit completed (OWASP Top 10)
- [ ] Privacy policy and Terms of Service published
- [ ] Incident response plan documented

**Post-Launch:**
- [ ] Monitor error rates and API latency
- [ ] Review call transcription accuracy
- [ ] Verify notification delivery rates (SMS, Push, Email)
- [ ] Check RBAC permission issues
- [ ] Collect user feedback from agents
- [ ] Measure lead capture rate and conversion

---

## 11. Conclusion

This Real Estate Agent Call-to-Lead system demonstrates the power of the **PMO Self-Service Software Platform**. By leveraging:

✅ **Universal Entity System** - No custom backend code for Customer/Task/Calendar
✅ **AI Chat Infrastructure** - Voice transcription + LLM analysis built-in
✅ **MCP Function Tools** - 60+ pre-built API operations
✅ **Person-Calendar System** - Event booking + RSVP automation
✅ **Notification Service** - Multi-channel message delivery
✅ **RBAC System** - Automatic permission management

**A complete industry-specific CRM application was built using only:**
1. Entity configuration (entityConfig.ts)
2. Settings table data (SQL inserts)
3. AI tool definitions (real-estate-tools.ts)
4. Mobile app UI (connects to universal API)

**No custom backend routes, no new database tables, no bespoke services required.**

This is the vision of a **self-service software platform**: domain experts configure business logic through metadata, while the platform handles all technical complexity. The same pattern can be applied to healthcare appointment booking, legal case management, hospitality reservations, or any other industry vertical.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Author:** PMO Platform Team
**Related Docs:**
- [AI Chat System](../ai_chat/AI_CHAT_SYSTEM.md)
- [Person-Calendar System](../PERSON_CALENDAR_SYSTEM.md)
- [Universal Entity System](../entity_design_pattern/universal_entity_system.md)
- [Platform Documentation Index](../README.md)
