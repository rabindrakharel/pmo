# Service Appointment & Task Management System

> **Complete documentation for AI-driven customer service request processing, task creation, and employee scheduling**

**Version:** 2.0
**Last Updated:** 2025-11-05
**Focus:** API-Level Integration

---

## 📚 Documentation Overview

This directory contains comprehensive **API-level** documentation for the PMO platform's service appointment and task management workflow, specifically designed for AI agent integration.

### Available Documents

| Document | Purpose | Audience | Focus |
|----------|---------|----------|-------|
| **[AI_AGENT_SERVICE_WORKFLOW.md](./AI_AGENT_SERVICE_WORKFLOW.md)** | Complete technical guide for implementing AI-driven service workflows | Developers, AI Engineers | API endpoints, TypeScript, React |
| **[IMPLEMENTATION_COOKBOOK.md](./IMPLEMENTATION_COOKBOOK.md)** | Copy-paste ready code examples and implementation patterns | Backend/Frontend Developers | API clients, service classes, testing |

**⚠️ Important:** All documentation in this directory focuses on **API-level integration only**. Database-level SQL queries and direct database access patterns have been removed in favor of REST API calls.

---

## 🎯 System Overview

The Service Appointment & Task Management System enables customers to request services through natural language chat with an AI agent. The system automates:

1. **Customer Identification**: Phone number-based lookup via API
2. **Task Creation**: Automatic service task generation from conversation
3. **Customer Onboarding**: Frictionless customer record creation for new customers
4. **Employee Assignment**: Skills-based matching with availability checking
5. **Calendar Booking**: Automatic scheduling and slot reservation
6. **Event Management**: Creation of service appointments with full context

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                         Customer Chat                            │
│                    (AI Agent Interface)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Agent Processing                           │
│   • Extract phone number, service type, urgency, location       │
│   • Understand customer needs via NLP                            │
│   • Build structured service request                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Step 1: Customer Lookup                         │
│   GET /api/v1/cust?phone=+14165551234                           │
│   • Found → Load customer context & history                      │
│   • Not Found → Flag for new customer creation                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Step 2: Task Creation (FIRST)                   │
│   POST /api/v1/task                                              │
│   • Service category, urgency, description                       │
│   • Location, customer phone, preferences                        │
│   • Conversation ID, extracted context                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           Step 3: Customer Creation (If New)                     │
│   POST /api/v1/cust                                              │
│   • Minimal data: phone + name (optional)                        │
│   • Link to initial task via metadata                            │
│   • Mark as created via AI agent                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Step 4: Employee Assignment                         │
│   1. GET /api/v1/employee?skills_service_categories=HVAC        │
│   2. GET /api/v1/employee/:id/availability                       │
│   3. Rank by match score (skills + availability + workload)      │
│   4. PUT /api/v1/task/:id (assign employee)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Step 5: Event & Calendar Booking                      │
│   1. POST /api/v1/event (appointment details)                    │
│   2. POST /api/v1/calendar/book (reserve slots)                  │
│   3. PUT /api/v1/task/:id (link event)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Step 6: Confirmation & Notification                │
│   • SMS to customer with appointment details                     │
│   • Push notification to assigned employee                       │
│   • Email summary to all parties                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Features

### 1. Phone Number-First Approach
- **Zero Friction**: Customers can book with just a phone number
- **Instant Recognition**: Existing customers automatically identified via API
- **Progressive Profiling**: Gather more details over time

### 2. Skills-Based Employee Matching
- **Automatic Qualification**: Match service requirements to employee skills
- **Array-Based Skills**: `skills_service_categories` field for flexible matching
- **Service Catalog Integration**: Skills sourced from `dl__service_category` settings

### 3. Real-Time Availability
- **15-Minute Granularity**: Precise slot-based scheduling
- **Instant Booking**: No manual confirmation needed via API
- **Conflict Prevention**: Automatic slot locking

### 4. Comprehensive Context Linking
- **Full Traceability**: Task → Customer → Employee → Event → Calendar
- **Metadata Linking**: All entities linked via `metadata` fields
- **Audit Trail**: Complete history from chat to completion

---

## 📊 API Endpoints Summary

### Customer Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/cust?phone=+14165551234` | Lookup customer by phone number |
| `POST` | `/api/v1/cust` | Create new customer record |
| `GET` | `/api/v1/task?metadata.customer_id={id}` | Get customer's task history |

### Task Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/task` | Create service task |
| `PUT` | `/api/v1/task/:id` | Update task (link customer, assign employee) |
| `GET` | `/api/v1/task/:id` | Get task details |

### Service Catalog

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/datalabel?name=dl__service_category` | Get service categories |
| `GET` | `/api/v1/service?service_category=HVAC` | Search services by category |

### Employee Matching

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/employee?skills_service_categories=HVAC` | Find employees by skills |
| `GET` | `/api/v1/employee/:id/availability?from=...&to=...` | Check employee availability |

### Event & Calendar

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/event` | Create service appointment |
| `POST` | `/api/v1/calendar/book` | Book calendar slots |

### AI Agent Orchestration

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/ai-agent/service-request` | Complete workflow orchestration |
| `POST` | `/api/v1/ai-agent/chat` | Conversational AI endpoint |

---

## 🔍 Data Models

### Customer

```typescript
interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;  // PRIMARY IDENTIFIER (E.164 format)
  email?: string;
  customer_type: 'residential' | 'commercial';
  metadata: {
    initial_task_id?: string;
    conversation_id?: string;
    created_via?: 'ai_agent' | 'manual' | 'web';
    profile_complete?: boolean;
  };
}
```

### Task

```typescript
interface Task {
  id: string;
  code: string;
  name: string;
  descr: string;
  stage: string;
  metadata: {
    service_category: string;          // HVAC, Plumbing, etc.
    service_id?: string;
    customer_id?: string;
    customer_phone: string;
    customer_name?: string;
    urgency_level: 'emergency' | 'urgent' | 'normal' | 'scheduled';
    service_address: string;
    conversation_id: string;
    assigned_employee_id?: string;
    event_id?: string;
    scheduled_at?: string;
  };
}
```

### Employee

```typescript
interface Employee {
  id: string;
  code: string;
  name: string;
  department: string;
  phone: string;
  email: string;
  skills_service_categories: string[];  // ['HVAC', 'Plumbing', 'Electrical']
  active_flag: boolean;
}
```

### Service

```typescript
interface Service {
  id: string;
  code: string;
  name: string;
  descr: string;
  service_category: string;  // References dl__service_category settings
  standard_rate_amt: number;
  estimated_hours: number;
  minimum_charge_amt: number;
  taxable_flag: boolean;
  requires_certification_flag: boolean;
}
```

### Event

```typescript
interface Event {
  id: string;
  code: string;
  name: string;
  descr: string;
  event_entity_action: string;  // 'hvac_repair', 'plumbing_service'
  event_medium: string;          // 'onsite', 'phone', 'video'
  event_addr: string;
  event_instructions: string;
  event_metadata: {
    task_id: string;
    customer_id: string;
    employee_id: string;
    service_category: string;
    estimated_duration_minutes: number;
  };
  reminder_sent_flag: boolean;
  confirmation_sent_flag: boolean;
}
```

### Calendar Slot

```typescript
interface CalendarSlot {
  id: string;
  person_entity_type: 'employee' | 'customer';
  person_entity_id: string;
  from_ts: string;              // ISO 8601 timestamp
  to_ts: string;                // ISO 8601 timestamp
  availability_flag: boolean;   // true = available, false = booked
  event_id?: string;            // Reference to event if booked
  name?: string;                // Description of booking
}
```

---

## 🚀 Quick Start Guide

### For Developers

**1. Read the Main Documentation**
```bash
# Start here for complete API-level details
cat AI_AGENT_SERVICE_WORKFLOW.md

# Get copy-paste code examples
cat IMPLEMENTATION_COOKBOOK.md
```

**2. Test the API Workflow**
```bash
# Use test-api.sh to simulate the workflow
./tools/test-api.sh GET "/api/v1/cust?phone=+14165551234"
./tools/test-api.sh POST "/api/v1/task" '{"name":"Test HVAC Repair",...}'
./tools/test-api.sh GET "/api/v1/employee?skills_service_categories=HVAC"
```

**3. Implement AI Integration**
- Connect to AI/LLM service (OpenAI, Anthropic Claude, etc.)
- Build conversation state management
- Implement NLP extraction for service details
- Use the orchestration endpoint: `POST /api/v1/ai-agent/service-request`

### For AI Engineers

**Key Integration Points:**

1. **Natural Language Processing**
   - Extract: service type, urgency, location, preferred time
   - Validate: phone number format, service availability
   - Clarify: missing information via follow-up questions

2. **Conversation State Management**
   - Track: conversation_id, extracted_info, customer_context
   - Store: Interaction history via `/api/v1/interaction`
   - Resume: partial conversations if customer drops off

3. **API Integration**
   - Primary Endpoint: `POST /api/v1/ai-agent/service-request`
   - Payload: `{ phoneNumber, conversationId, extractedInfo }`
   - Response: `{ task, customer, employee, event, appointment }`

**Example API Call:**
```typescript
const response = await fetch('/api/v1/ai-agent/service-request', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phoneNumber: '+14165551234',
    conversationId: 'conv-uuid-here',
    extractedInfo: {
      customerName: 'John Smith',
      serviceCategory: 'HVAC',
      urgencyLevel: 'urgent',
      problemDescription: 'Furnace not heating',
      serviceAddress: '123 Main St, Toronto, ON',
      preferredDateTime: '2025-11-06T14:00:00Z',
      estimatedDuration: 120,
      customerNotes: 'Customer has two dogs'
    }
  })
});

const result = await response.json();
// result.task, result.customer, result.employee, result.event
```

---

## 📋 Implementation Checklist

### Phase 1: Backend API ✅
- [x] Customer lookup API endpoint
- [x] Task creation API endpoint
- [x] Employee matching API endpoint
- [x] Event creation API endpoint
- [x] Calendar booking API endpoint
- [ ] AI agent orchestration service
- [ ] Unified service request API endpoint

### Phase 2: AI Integration
- [ ] Connect to LLM service (OpenAI/Claude)
- [ ] Build NLP extraction logic
- [ ] Implement conversation state machine
- [ ] Create chat API endpoint
- [ ] Add error handling and validation

### Phase 3: Frontend
- [ ] Build AI chat widget component (React)
- [ ] Create confirmation UI
- [ ] Add real-time availability display
- [ ] Implement customer portal
- [ ] Build employee mobile view

### Phase 4: Notifications
- [ ] SMS confirmations (Twilio)
- [ ] Email notifications (SendGrid)
- [ ] Push notifications (Firebase)
- [ ] Reminder system (24h before)

### Phase 5: Analytics & Optimization
- [ ] Track conversion metrics (chat → booking)
- [ ] Monitor employee utilization
- [ ] Measure customer satisfaction
- [ ] Optimize assignment algorithm
- [ ] A/B test conversation flows

---

## 🎯 Example Use Cases

### Use Case 1: Emergency HVAC Repair
**Customer:** "My furnace stopped working, it's freezing!"

**AI Workflow:**
1. `GET /api/v1/cust?phone=...` → Identify customer
2. `POST /api/v1/task` → Create urgent HVAC task
3. `GET /api/v1/employee?skills=HVAC` → Find HVAC techs
4. `GET /api/v1/employee/:id/availability` → Check today's availability
5. `POST /api/v1/event` → Create same-day appointment
6. `POST /api/v1/calendar/book` → Reserve slots

**Result:** Same-day appointment scheduled within minutes

### Use Case 2: Scheduled AC Maintenance
**Customer:** "I need my AC serviced before summer"

**AI Workflow:**
1. `GET /api/v1/cust?phone=...` → Recognize returning customer
2. `GET /api/v1/task?metadata.customer_id=...` → Load service history
3. `POST /api/v1/task` → Create normal-priority task
4. `GET /api/v1/employee/:id/availability` → Offer multiple dates
5. Customer chooses → Book preferred slot

**Result:** Flexible scheduling with multiple options

### Use Case 3: New Customer Onboarding
**Customer:** "I'm new to the area, need plumbing help"

**AI Workflow:**
1. `GET /api/v1/cust?phone=...` → Not found
2. `POST /api/v1/task` → Create task first (with phone)
3. `POST /api/v1/cust` → Create minimal customer record
4. `PUT /api/v1/task/:id` → Link customer to task
5. Assign plumber and book appointment

**Result:** Frictionless onboarding, gather more info later

### Use Case 4: Multi-Service Request
**Customer:** "I need both HVAC and electrical work"

**AI Workflow:**
1. Create two separate tasks via `POST /api/v1/task` (x2)
2. Find HVAC specialist → Assign
3. Find electrician → Assign
4. Coordinate scheduling to minimize visits
5. Create linked events

**Result:** Two specialists assigned, coordinated scheduling

---

## 🔍 Troubleshooting

### Common Issues

**Issue: No employees found with required skills**
```bash
# Check available employees via API
curl -X GET "http://localhost:4000/api/v1/employee?skills_service_categories=HVAC" \
  -H "Authorization: Bearer <token>"
```
**Solution:** Verify service category naming matches `dl__service_category` settings

**Issue: No available time slots**
```bash
# Check employee availability
curl -X GET "http://localhost:4000/api/v1/employee/:id/availability?from=...&to=..." \
  -H "Authorization: Bearer <token>"
```
**Solution:** Calendar slots might need regeneration or employee schedules need review

**Issue: Customer phone lookup fails**
```bash
# Test phone lookup
curl -X GET "http://localhost:4000/api/v1/cust?phone=%2B14165551234" \
  -H "Authorization: Bearer <token>"
```
**Solution:** Ensure phone format is E.164 (`+14165551234`), not `(416) 555-1234`

**Issue: Task creation succeeds but customer creation fails**
**Solution:** This is by design - task is preserved. Retry customer creation separately.

---

## 📞 Support & Questions

**For Technical Issues:**
- Review: `AI_AGENT_SERVICE_WORKFLOW.md` - Complete API workflow guide
- Code Examples: `IMPLEMENTATION_COOKBOOK.md` - Copy-paste ready patterns
- API Testing: `/home/rabin/projects/pmo/tools/test-api.sh`

**For Architecture Questions:**
- Platform Overview: `/home/rabin/projects/pmo/docs/ui_ux_route_api.md`
- Entity System: `/home/rabin/projects/pmo/docs/entity_design_pattern/universal_entity_system.md`
- Data Model: `/home/rabin/projects/pmo/docs/datamodel.md`
- Main README: `/home/rabin/projects/pmo/CLAUDE.md`

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025-11-05 | **API-Level Focus** - Removed SQL, added REST API patterns, TypeScript clients, testing scripts |
| 1.0 | 2025-11-05 | Initial documentation - AI agent workflow, database schema, implementation guide |

---

**Last Updated:** 2025-11-05
**Maintained By:** PMO Platform Team
**Status:** ✅ Active Development
**Focus:** **API-Level Integration Only** (No SQL)
