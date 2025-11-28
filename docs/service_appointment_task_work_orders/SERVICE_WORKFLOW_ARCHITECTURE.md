# Service Appointment & Task Workflow Architecture

> **Comprehensive technical guide for AI-driven customer service request processing, task creation, and employee assignment**

**Version:** 3.0
**Last Updated:** 2025-11-05
**Audience:** Advanced Software Engineers, Solutions Architects, AI/LLM Agents
**Focus:** API-First Architecture, DRY Patterns, Entity Orchestration

---

## 1. Semantics & Business Context

### 1.1 Business Problem

Home services companies face customer acquisition friction: customers must create accounts, fill forms, and navigate complex booking flows before getting help. This workflow eliminates barriers by enabling **conversational service booking** through AI agents.

### 1.2 Core Workflow Semantics

**Phone Number-First Identity**
- Phone number serves as PRIMARY customer identifier (E.164 format: `+14165551234`)
- Enables instant recognition of returning customers via API lookup
- New customers can book without account creation
- Progressive profiling: gather additional data over time

**Task-First Creation Pattern**
- Service requests become `d_task` records BEFORE customer records
- Ensures atomic capture of service need
- Prevents orphaned requests if customer creation fails
- Task metadata stores customer phone even if customer record pending

**Skills-Based Employee Matching**
- Employees carry `skills_service_categories` array field
- Service categories sourced from `datalabel_service_category` table
- Matching algorithm: find employees with required skill AND calendar availability
- Examples: `["HVAC"]` (specialist), `["HVAC", "Plumbing", "Electrical"]` (generalist)

**15-Minute Calendar Granularity**
- `d_entity_person_calendar` stores slots in 15-minute increments
- Slot structure: `{ from_ts, to_ts, person_entity_code, person_entity_id, availability_flag, event_id }`
- Booking: flip `availability_flag` from `true` to `false`, attach `event_id`
- Prevents double-booking through immediate slot reservation

### 1.3 Service Categories (Settings-Driven)

All service taxonomies reference `datalabel_service_category`:
- **HVAC**: Heating, ventilation, air conditioning (furnaces, AC units, thermostats)
- **Plumbing**: Pipes, drains, fixtures, water heaters
- **Electrical**: Wiring, outlets, panels, lighting
- **Landscaping**: Lawn care, outdoor maintenance, irrigation
- **General Contracting**: Renovations, construction, repairs

### 1.4 Urgency Levels & Service Expectations

| Urgency | Response Time | Typical Scenarios | Booking Window |
|---------|--------------|-------------------|----------------|
| **emergency** | Same-day, ASAP | No heat in winter, major leak, power outage | 0-4 hours |
| **urgent** | Next available, <24h | Intermittent issues, broken appliance | 4-24 hours |
| **normal** | Within 2-3 days | Non-critical repairs, installations | 1-3 days |
| **scheduled** | Flexible, customer choice | Routine maintenance, inspections | 1+ weeks |

---

## 2. Architecture, Block Diagrams & DRY Design Patterns

### 2.1 System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    AI AGENT LAYER                             │
│  • Natural language processing (OpenAI/Claude)                │
│  • Conversation state management                              │
│  • Information extraction (phone, service, urgency, location) │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              ORCHESTRATION SERVICE LAYER                      │
│  • AIAgentOrchestratorService (TypeScript)                    │
│  • Workflow coordination (6 steps)                            │
│  • API client aggregation (Customer, Task, Employee, Event)   │
└────────────────────────┬─────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┬───────────────┐
         ▼               ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Customer API │  │   Task API   │  │ Employee API │  │  Event API   │
│              │  │              │  │              │  │              │
│ GET /cust    │  │ POST /task   │  │ GET /employee│  │ POST /event  │
│ POST /cust   │  │ PUT /task    │  │ GET /avail   │  │ POST /calendar│
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       └─────────────────┼─────────────────┼─────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                             │
│  • d_client (customer records)                                │
│  • d_task (service requests)                                  │
│  • d_employee (technicians with skills)                       │
│  • d_event (appointments)                                     │
│  • d_entity_person_calendar (availability slots)              │
│  • d_service (service catalog)                                │
│  • f_interaction (conversation history)                       │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Workflow State Machine

```
[Customer Chat]
       │
       ▼
[Extract Phone Number] ──────────────┐
       │                             │
       ▼                             │
[Lookup Customer]                    │
       │                             │
       ├─ Found ──> [Load Context]   │
       │            [Service History]│
       │                             │
       └─ Not Found ──> [Flag New]   │
                        [Defer Create]│
                             │        │
                             ▼        │
                      [CREATE TASK]◄──┘ ← CRITICAL: Task created FIRST
                             │
                             ├─ New Customer? ──> [CREATE CUSTOMER]
                             │                    [LINK to Task]
                             │
                             ▼
                      [Find Employees]
                      [Filter by Skills]
                             │
                             ▼
                      [Check Availability]
                      [Rank by Match Score]
                             │
                             ▼
                      [ASSIGN EMPLOYEE]
                      [Update Task Metadata]
                             │
                             ▼
                      [CREATE EVENT]
                      [BOOK CALENDAR SLOTS]
                             │
                             ▼
                      [LINK EVENT TO TASK]
                             │
                             ▼
                      [SEND CONFIRMATIONS]
                             │
                             ▼
                      [Return Success]
```

### 2.3 DRY Patterns & Design Principles

**Pattern 1: API Client Abstraction**
```
Principle: Single responsibility API clients
Structure:
  - CustomerAPIClient: findByPhone(), create(), getTaskHistory()
  - TaskAPIClient: create(), update(), get()
  - EmployeeAPIClient: findBySkills(), checkAvailability()
  - EventAPIClient: create(), bookCalendar()

Benefit: Reusable, testable, type-safe API interactions
```

**Pattern 2: Metadata-Driven Linkage**
```
Principle: JSONB metadata fields connect entities without rigid FK constraints
Implementation:
  - Task.metadata.customer_id → Links to customer
  - Task.metadata.assigned_employee_id → Links to employee
  - Task.metadata.event_id → Links to appointment
  - Task.metadata.conversation_id → Links to chat interaction

Benefit: Flexible relationships, progressive data enrichment
```

**Pattern 3: Settings-Driven Configuration**
```
Principle: Reference data via settings tables, not hardcoded enums
Tables:
  - datalabel_service_category (HVAC, Plumbing, Electrical, ...)
  - datalabel_task_priority (emergency, urgent, normal, scheduled)
  - datalabel_customer_tier (premium, standard, basic)

API: GET /api/v1/datalabel?name=dl__service_category
Benefit: Business users can modify categories without code changes
```

**Pattern 4: Task-First Creation (Anti-Orphan Pattern)**
```
Problem: Customer creation might fail, losing service request
Solution: Create Task FIRST with customer phone number
Sequence:
  1. POST /api/v1/task (customer_phone in metadata, customer_id=null)
  2. POST /api/v1/cust (if new customer)
  3. PUT /api/v1/task (update with customer_id)

Benefit: Service request never lost, can retry customer creation
```

**Pattern 5: Skills Array Matching**
```
Principle: Employees carry array of service categories, match via containment
Query: GET /api/v1/employee?skills_service_categories=HVAC
Filter: WHERE 'HVAC' = ANY(skills_service_categories)
Benefit: One employee can handle multiple services, flexible assignment
```

**Pattern 6: Slot-Based Availability**
```
Principle: Pre-generate 15-minute slots, book by flipping availability flag
Structure:
  - Generate slots: 9:00 AM - 8:00 PM, daily, per employee
  - Check availability: Count available slots in time range
  - Book: UPDATE SET availability_flag=false, event_id=<uuid>

Benefit: Instant availability checks, no complex calendar math
```

### 2.4 Error Handling Strategy

**Graceful Degradation Hierarchy**
```
1. No qualified employees → Offer alternative services or waitlist
2. No available slots → Return next available time, offer cancellation list
3. Customer creation fails → Task still exists, retry customer creation later
4. Event creation fails → Rollback task assignment, retry entire workflow
5. Calendar booking fails → Rollback event, free up employee assignment
```

**Retry & Idempotency**
```
- All POST/PUT operations return entity IDs
- Subsequent calls with same data are idempotent
- Task codes auto-generated (TASK-12345) prevent duplicates
- Metadata tracks creation source (ai_agent, web, manual) for audit
```

---

## 3. Database, API & UI/UX Mapping

### 3.1 Entity-to-Table Mapping

| Business Entity | Database Table | API Endpoint | Frontend View |
|----------------|----------------|--------------|---------------|
| Customer | `d_client` | `/api/v1/cust` | `/cust` (EntityListOfInstancesPage) |
| Service Request | `d_task` | `/api/v1/task` | `/task` (EntityListOfInstancesPage) |
| Technician | `d_employee` | `/api/v1/employee` | `/employee` (EntityListOfInstancesPage) |
| Appointment | `d_event` | `/api/v1/event` | `/event` (EntityListOfInstancesPage) |
| Calendar Slot | `d_entity_person_calendar` | `/api/v1/person-calendar` | `/person_calendar` (CalendarView) |
| Service Catalog | `d_service` | `/api/v1/service` | `/service` (EntityListOfInstancesPage) |
| Chat History | `f_interaction` | `/api/v1/interaction` | N/A (backend only) |

### 3.2 API Workflow Sequence

**Complete Service Request Flow:**
```
Request: POST /api/v1/ai-agent/service-request
Payload: { phoneNumber, conversationId, extractedInfo: {...} }

Internal Orchestration:
  1. GET /api/v1/cust?phone=+14165551234
     Response: { data: [customer] } or { data: [] }

  2. POST /api/v1/task
     Payload: { name, descr, metadata: { service_category, customer_phone, urgency_level, ... } }
     Response: { id: "task-uuid", code: "TASK-123", ... }

  3. IF (customer not found):
       POST /api/v1/cust
       Payload: { phone, name, metadata: { initial_task_id, created_via: "ai_agent" } }
       Response: { id: "cust-uuid", code: "CL-RES-456", ... }

       PUT /api/v1/task/:taskId
       Payload: { metadata: { customer_id: "cust-uuid" } }

  4. GET /api/v1/employee?skills_service_categories=HVAC&active=true
     Response: { data: [employee1, employee2, ...] }

  5. FOR EACH qualified employee:
       GET /api/v1/employee/:empId/availability?from=2025-11-06T14:00:00Z&to=2025-11-06T16:00:00Z
       Response: { available: true, total_available_minutes: 120, ... }
       IF (available) → BREAK, assign this employee

  6. PUT /api/v1/task/:taskId
     Payload: { metadata: { assigned_employee_id: "emp-uuid", assigned_at: "...", assigned_by: "ai_agent" } }

  7. POST /api/v1/event
     Payload: { name, event_entity_action, event_medium: "onsite", event_addr, event_metadata: {...} }
     Response: { id: "evt-uuid", code: "EVT-20251106-789", ... }

  8. POST /api/v1/calendar/book
     Payload: { employee_id, event_id, from_ts, to_ts, name }
     Response: { success: true, slots_booked: 8, ... }

  9. PUT /api/v1/task/:taskId
     Payload: { metadata: { event_id: "evt-uuid", scheduled_at: "..." } }

Final Response:
  { success: true, task, customer, employee, event, appointment: { dateTime, duration, address } }
```

### 3.3 Data Flow Diagram

```
Customer Phone Number
        │
        ▼
   Customer Lookup ───────┐
        │                 │
        ├─ Exists ────────┤
        │                 │
        └─ New ───────────┤
                          │
                          ▼
                    Task Record ────────┐
                          │             │
                          │  metadata:  │
                          │  - customer_id
                          │  - service_category
                          │  - urgency_level
                          │  - customer_phone
                          │             │
                          ▼             │
                  Employee Matching     │
                          │             │
                  skills_service_categories
                  availability_slots    │
                          │             │
                          ▼             │
                  Assignment ───────────┤
                  metadata.assigned_employee_id
                          │             │
                          ▼             │
                   Event Record ────────┤
                          │             │
                   event_metadata:      │
                   - task_id            │
                   - customer_id        │
                   - employee_id        │
                          │             │
                          ▼             │
                  Calendar Booking ─────┘
                          │
                  8 slots @ 15min each
                  availability_flag = false
```

### 3.4 Frontend-Backend Contract

**AI Chat Widget → Backend API:**
```
Frontend: POST /api/v1/ai-agent/chat
Payload:
  {
    message: "My furnace isn't working",
    conversationHistory: [
      { role: "assistant", text: "Can I get your phone number?", timestamp: "..." },
      { role: "user", text: "416-555-1234", timestamp: "..." }
    ]
  }

Backend Processing:
  - NLP extraction: phone number, service type, urgency
  - Validation: phone format (E.164), service category exists
  - State tracking: conversation_id, extracted fields
  - Decision: if all required info collected → process service request

Response:
  {
    response: "I understand you need HVAC service. When would you like us to come?",
    serviceRequest: null  // OR full booking details if complete
  }
```

**Calendar View → Backend API:**
```
Frontend: GET /api/v1/person-calendar?person_entity_code=employee&person_entity_id=<uuid>
Response:
  {
    data: [
      { id, from_ts: "2025-11-06T09:00:00Z", to_ts: "2025-11-06T09:15:00Z", availability_flag: true },
      { id, from_ts: "2025-11-06T09:15:00Z", to_ts: "2025-11-06T09:30:00Z", availability_flag: false, event_id: "..." },
      ...
    ]
  }

Frontend Rendering:
  - Grid: Monday-Friday, 9 AM - 8 PM
  - Color coding: Green (available), Red (booked), Blue (selected)
  - Multi-select: Overlay multiple employees' calendars
  - Click handler: Navigate to event details or book new slot
```

---

## 4. Entity Relationships

### 4.1 Core Entity Graph

```
┌──────────────┐
│   Customer   │──────────────┐
│  (d_client)  │              │
└──────┬───────┘              │
       │ 1:N                  │
       │                      │ 1:N
       ▼                      ▼
┌──────────────┐        ┌──────────────┐
│     Task     │◄───────│     Event    │
│   (d_task)   │  1:1   │   (d_event)  │
└──────┬───────┘        └──────┬───────┘
       │                       │
       │ N:1                   │ 1:N
       │                       │
       ▼                       ▼
┌──────────────┐        ┌─────────────────────────┐
│   Employee   │───────▶│    Calendar Slots       │
│ (d_employee) │  1:N   │ (d_entity_person_calendar) │
└──────────────┘        └─────────────────────────┘

┌──────────────┐
│   Service    │
│ (d_service)  │
└──────────────┘
       │
       │ N:1 (reference only)
       │
       ▼
┌──────────────┐
│Task.metadata │
│.service_id   │
└──────────────┘
```

### 4.2 Relationship Semantics

**Customer → Task (1:N)**
```
Linkage: Task.metadata.customer_id → Customer.id
Cardinality: One customer can have many service requests
Nullability: Task can exist WITHOUT customer (new customers, phone-only)
Lifecycle: Task created BEFORE customer for new customers
```

**Task → Event (1:1)**
```
Linkage: Task.metadata.event_id → Event.id
Cardinality: One task has exactly one scheduled appointment
Nullability: Task exists without event (not yet scheduled)
Lifecycle: Event created AFTER task, employee assigned
```

**Employee → Task (1:N)**
```
Linkage: Task.metadata.assigned_employee_id → Employee.id
Cardinality: One employee handles many tasks
Nullability: Task exists without employee (unassigned, pending)
Selection: Filtered by skills_service_categories, checked for availability
```

**Employee → Calendar Slots (1:N)**
```
Linkage: CalendarSlot.person_entity_id → Employee.id (when person_entity_code='employee')
Cardinality: One employee has many 15-minute slots (pre-generated)
Booking: Event.id attached to slots, availability_flag flipped to false
Query: "Find all available slots for employee X between time Y and Z"
```

**Event → Calendar Slots (1:N)**
```
Linkage: CalendarSlot.event_id → Event.id
Cardinality: One event occupies multiple consecutive 15-minute slots
Example: 2-hour appointment = 8 slots (120 minutes ÷ 15 = 8)
Constraint: All slots must belong to same employee, be consecutive, be available
```

**Service → Task (Reference Only)**
```
Linkage: Task.metadata.service_id → Service.id
Cardinality: Many tasks reference one service type
Optional: Task can exist with service_category string only, no specific service ID
Use Case: Specific service selection (e.g., "AC Tune-Up" vs generic "HVAC Service")
```

### 4.3 Metadata-Driven Relationships (JSONB)

**Task Metadata Schema:**
```typescript
Task.metadata = {
  // Customer linkage
  customer_id?: string,          // UUID reference to d_client
  customer_phone: string,         // E.164 format, ALWAYS present
  customer_name?: string,         // Extracted from conversation

  // Service linkage
  service_id?: string,            // UUID reference to d_service
  service_category: string,       // "HVAC", "Plumbing", etc.

  // Assignment linkage
  assigned_employee_id?: string,  // UUID reference to d_employee
  assigned_at?: string,           // ISO 8601 timestamp
  assigned_by?: string,           // "ai_agent", "manual", "auto"

  // Event linkage
  event_id?: string,              // UUID reference to d_event
  scheduled_at?: string,          // ISO 8601 appointment time

  // Context linkage
  conversation_id?: string,       // UUID reference to f_interaction
  extracted_context?: object,     // AI-extracted details

  // Operational data
  urgency_level: string,          // "emergency", "urgent", "normal", "scheduled"
  service_address: string,        // Full address string
  location_metadata?: {
    access_codes?: string,
    parking_instructions?: string,
    pet_information?: string
  },
  preferred_date_time?: string,   // ISO 8601 preferred time
  estimated_duration_minutes?: number,
  customer_notes?: string
}
```

**Event Metadata Schema:**
```typescript
Event.event_metadata = {
  task_id: string,                    // UUID reference to d_task (REQUIRED)
  customer_id: string,                // UUID reference to d_client
  employee_id: string,                // UUID reference to d_employee
  service_category: string,           // "HVAC", "Plumbing", etc.
  urgency_level: string,              // Match from task
  estimated_duration_minutes: number, // Expected appointment length
  customer_phone: string,             // Contact info
  actual_start_time?: string,         // When employee actually arrived
  actual_end_time?: string,           // When work completed
  completion_notes?: string           // Post-service summary
}
```

### 4.4 Conversation → Entity Linkage

```
Interaction Record (f_interaction)
        │
        │ conversation_id
        │
        ▼
Task.metadata.conversation_id ───────┐
        │                            │
        │                            │
        ▼                            │
Customer.metadata.conversation_id    │
        │                            │
        │                            │
        ▼                            │
Event.event_metadata (optional) ◄────┘

Purpose: Full audit trail from chat message to completed service
Query: "Show all tasks created from conversation X"
       "Show chat history that led to event Y"
```

---

## 5. Central Configuration & Middleware

### 5.1 Entity Configuration (DRY Frontend Config)

**Location:** `apps/web/src/lib/entityConfig.ts`

**Pattern:** Single source of truth for entity behavior across all views (table, kanban, grid, calendar)

**Task Entity Configuration Example:**
```typescript
task: {
  name: 'task',
  displayName: 'Task',
  pluralName: 'Tasks',
  apiEndpoint: '/api/v1/task',
  supportedViews: ['table', 'kanban'],

  columns: [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'stage', label: 'Stage', badgeColor: statusColor },
    { key: 'metadata.urgency_level', label: 'Urgency', ... },
    { key: 'metadata.service_category', label: 'Service', ... },
    { key: 'metadata.assigned_employee_id', label: 'Employee', ... }
  ],

  fields: [
    { key: 'name', type: 'text', required: true },
    { key: 'descr', type: 'textarea' },
    { key: 'metadata.service_category', type: 'select', loadOptionsFromSettings: 'service_category' },
    { key: 'metadata.urgency_level', type: 'select', options: ['emergency', 'urgent', 'normal', 'scheduled'] },
    { key: 'metadata.service_address', type: 'text' }
  ],

  kanban: {
    groupByField: 'stage',
    columns: [
      { id: 'Open', name: 'Open', color: 'blue' },
      { id: 'In Progress', name: 'In Progress', color: 'yellow' },
      { id: 'Completed', name: 'Completed', color: 'green' }
    ]
  }
}
```

**Calendar Entity Configuration Example:**
```typescript
person_calendar: {
  name: 'person_calendar',
  displayName: 'Calendar',
  apiEndpoint: '/api/v1/person-calendar',
  supportedViews: ['table', 'calendar'],

  calendarConfig: {
    personEntityTypes: ['employee', 'customer'],
    timeSlotDuration: 15,  // minutes
    dayStartHour: 9,       // 9 AM
    dayEndHour: 20,        // 8 PM
    workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    colorScheme: {
      available: 'green',
      booked: 'red',
      selected: 'blue'
    }
  }
}
```

### 5.2 Settings Integration (Runtime Configuration)

**Settings Tables:**
```
datalabel_service_category     → Service types (HVAC, Plumbing, ...)
datalabel_task_priority        → Urgency levels
datalabel_customer_tier        → Customer segments
```

**API Integration:**
```
Frontend: GET /api/v1/datalabel?name=dl__service_category
Backend: SELECT id, name, descr FROM app.datalabel_service_category WHERE active_flag = true
Response: { data: [{ id: "0", name: "HVAC", descr: "..." }, ...] }

Usage in Forms:
  - Dropdown options: Loaded dynamically from settings API
  - Validation: Backend validates against current settings values
  - Extensibility: Business users can add new categories without code changes
```

### 5.3 Middleware Stack

**Authentication Middleware:**
```
fastify.addHook('preHandler', fastify.authenticate)
- Validates JWT token from Authorization header
- Extracts user.sub (employee ID) for RBAC
- Rejects requests with invalid/expired tokens
```

**RBAC Middleware:**
```
- Checks entity_rbac for permissions
- Permission levels: [0:view, 1:comment, 2:contribute, 3:edit, 4:share, 5:delete, 6:create, 7:owner]
- entity_id='all' grants type-wide access
- Specific UUIDs scope to individual records
```

**Validation Middleware:**
```
- JSON Schema validation via @sinclair/typebox
- Phone number format: E.164 regex (^\+[1-9]\d{1,14}$)
- UUID format validation
- Required field enforcement
```

**Error Handling Middleware:**
```
fastify.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    reply.status(400).send({ error: 'VALIDATION_ERROR', details: error.validation })
  } else if (error.statusCode === 401) {
    reply.status(401).send({ error: 'UNAUTHORIZED' })
  } else {
    reply.status(500).send({ error: 'INTERNAL_SERVER_ERROR', message: error.message })
  }
})
```

### 5.4 API Client Factory (DRY Pattern)

**Structure:**
```typescript
// Centralized API client instantiation
class CustomerAPIClient { ... }
class TaskAPIClient { ... }
class EmployeeAPIClient { ... }
class EventAPIClient { ... }

// Orchestrator service aggregates clients
class AIAgentOrchestratorService {
  private customerClient: CustomerAPIClient
  private taskClient: TaskAPIClient
  private employeeClient: EmployeeAPIClient
  private eventClient: EventAPIClient

  constructor(baseUrl: string, authToken: string) {
    this.customerClient = new CustomerAPIClient(baseUrl, authToken)
    this.taskClient = new TaskAPIClient(baseUrl, authToken)
    // ...
  }

  async processServiceRequest(request: ServiceRequest) {
    const customer = await this.customerClient.findByPhone(...)
    const task = await this.taskClient.create(...)
    const employee = await this.employeeClient.findBySkills(...)
    // ...
  }
}
```

**Benefit:** Single import for entire workflow, consistent error handling, reusable across contexts

---

## 6. User Interaction Flow Examples

### 6.1 Scenario: Emergency HVAC Repair (New Customer)

**Conversation:**
```
User: "Hi, my furnace stopped working and it's freezing in here!"
AI:   "I'm sorry to hear that! Let me help you right away. Can I get your phone number?"
User: "416-555-1234"
AI:   [System: Customer lookup → Not found, flag as new]
      "Thank you! What seems to be the problem with your furnace?"
User: "It's been running for 30 minutes but only blowing cold air"
AI:   [System: Extract service_category=HVAC, urgency_level=emergency]
      "That sounds urgent. When would you like a technician to come?"
User: "Today if possible, ASAP"
AI:   "What's the address where we should send the technician?"
User: "123 Main Street, Toronto"
AI:   "Perfect. Any special instructions? Parking, access codes, pets?"
User: "I have two friendly dogs, park in the driveway"
AI:   [System: Execute workflow]
      ✓ Task created: TASK-12345
      ✓ Customer created: CL-RES-456 (416-555-1234)
      ✓ Matched: Mike Chen (HVAC specialist)
      ✓ Available: Today 2:00 PM - 4:00 PM
      ✓ Event: EVT-20251106-789
      ✓ Calendar: 8 slots booked

      "Great news! I've scheduled Mike Chen, our HVAC specialist, to visit you today at 2:00 PM.
       He'll have a 2-hour window to diagnose and repair your furnace. You'll receive a confirmation
       text at 416-555-1234 shortly. Is there anything else you need?"
```

**System Actions:**
```
1. GET /api/v1/cust?phone=+14165551234 → { data: [] }
2. POST /api/v1/task → { id: "task-uuid", code: "TASK-12345" }
3. POST /api/v1/cust → { id: "cust-uuid", code: "CL-RES-456" }
4. PUT /api/v1/task/task-uuid → { metadata: { customer_id: "cust-uuid" } }
5. GET /api/v1/employee?skills_service_categories=HVAC → { data: [emp1, emp2] }
6. GET /api/v1/employee/emp1-uuid/availability?from=...&to=... → { available: true }
7. PUT /api/v1/task/task-uuid → { metadata: { assigned_employee_id: "emp1-uuid" } }
8. POST /api/v1/event → { id: "evt-uuid", code: "EVT-20251106-789" }
9. POST /api/v1/calendar/book → { success: true, slots_booked: 8 }
10. PUT /api/v1/task/task-uuid → { metadata: { event_id: "evt-uuid" } }
```

### 6.2 Scenario: Routine Maintenance (Returning Customer)

**Conversation:**
```
User: "I need to schedule my annual AC maintenance"
AI:   "Of course! Can I have your phone number?"
User: "416-555-9876"
AI:   [System: Customer lookup → Found: Sarah Johnson, CL-RES-012]
      [System: Load service history → Last service: Furnace, March 2025]
      "Welcome back, Sarah! I see you had your furnace serviced with us in March.
       When would you like to schedule your AC maintenance?"
User: "Next week sometime, maybe Tuesday or Wednesday"
AI:   [System: Check availability → Multiple slots available both days]
      "I have availability on Tuesday, November 12th at 10:00 AM or Wednesday,
       November 13th at 2:00 PM. Which works better for you?"
User: "Wednesday at 2 works great"
AI:   "Perfect! I'll book that for you. Same address - 456 Oak Avenue, correct?"
User: "Yes, that's right"
AI:   [System: Execute workflow]
      ✓ Task created: TASK-45678
      ✓ Linked to existing customer: CL-RES-012
      ✓ Assigned: Mike Chen (same tech as last time)
      ✓ Event: EVT-20251113-890
      ✓ Calendar: Wednesday, Nov 13, 2-3 PM

      "All set, Sarah! Mike Chen will be there on Wednesday, November 13th at 2:00 PM
       for your AC maintenance. You'll receive a reminder the day before. See you then!"
```

**System Actions:**
```
1. GET /api/v1/cust?phone=+14165559876 → { data: [{ id: "cust-uuid", name: "Sarah Johnson", ... }] }
2. GET /api/v1/task?metadata.customer_id=cust-uuid&limit=10 → { data: [previous tasks] }
3. POST /api/v1/task → { id: "task-uuid", code: "TASK-45678", metadata: { customer_id: "cust-uuid" } }
4. GET /api/v1/employee?skills_service_categories=HVAC → { data: [Mike Chen, ...] }
5. GET /api/v1/employee/mike-uuid/availability?from=...&to=... → { available: true }
6. PUT /api/v1/task/task-uuid → { metadata: { assigned_employee_id: "mike-uuid" } }
7. POST /api/v1/event → { id: "evt-uuid", code: "EVT-20251113-890" }
8. POST /api/v1/calendar/book → { success: true, slots_booked: 4 }
9. PUT /api/v1/task/task-uuid → { metadata: { event_id: "evt-uuid" } }
```

### 6.3 Scenario: Multi-Service Request

**Conversation:**
```
User: "I need both HVAC and electrical work done"
AI:   "No problem! Let me help you with both. Can I get your phone number first?"
User: "416-555-1111"
AI:   [System: Customer lookup → Found existing customer]
      "Thanks! Can you describe the HVAC issue?"
User: "AC not cooling properly"
AI:   "And what electrical work do you need?"
User: "Need to install three new outlets in the basement"
AI:   "How urgent are these issues?"
User: "Not an emergency, but would like them done this week"
AI:   [System: Create TWO tasks, find specialists for each]
      ✓ Task 1 (HVAC): TASK-11111, assigned to Mike Chen (HVAC)
      ✓ Task 2 (Electrical): TASK-22222, assigned to Lisa Wong (Electrical)
      ✓ Coordinated scheduling: Same day, sequential appointments

      "Perfect! I've scheduled two appointments for you this Thursday:
       - Mike Chen (HVAC) at 9:00 AM for the AC issue
       - Lisa Wong (Electrical) at 1:00 PM for the outlet installation
       Both at your address. Sound good?"
```

**System Actions:**
```
1. GET /api/v1/cust?phone=+14165551111 → { data: [customer] }
2. POST /api/v1/task (HVAC) → { id: "task1-uuid", code: "TASK-11111" }
3. POST /api/v1/task (Electrical) → { id: "task2-uuid", code: "TASK-22222" }
4. GET /api/v1/employee?skills_service_categories=HVAC → [Mike Chen]
5. GET /api/v1/employee?skills_service_categories=Electrical → [Lisa Wong]
6. Check availability for both, coordinate non-overlapping times
7. Create events for both tasks
8. Book calendar slots for both employees
```

---

## 7. Critical Considerations When Building

### 7.1 Data Integrity & Consistency

**Problem:** Customer creation might fail after task creation
**Solution:** Task-first pattern ensures service request never lost
```
✓ ALWAYS create task before customer for new customers
✓ Store customer_phone in task.metadata even if customer_id is null
✓ Implement retry logic for customer creation (idempotent)
✓ Link customer to task via PUT after customer creation succeeds
```

**Problem:** Calendar slot conflicts (double-booking)
**Solution:** Atomic slot reservation with database constraints
```
✓ Use database transactions for calendar booking
✓ Check availability_flag = true before flipping to false
✓ Attach event_id in same transaction as flag flip
✓ Implement optimistic locking (check updated_ts hasn't changed)
```

**Problem:** Employee assigned but no available slots
**Solution:** Verify availability BEFORE assignment
```
✓ Check availability first: GET /employee/:id/availability
✓ Only assign if total_available_minutes >= estimated_duration_minutes
✓ Reserve slots immediately after assignment (don't delay)
✓ Rollback assignment if calendar booking fails
```

### 7.2 Performance & Scalability

**Problem:** N+1 queries when checking availability for multiple employees
**Solution:** Batch availability checks or pre-filter by calendar data
```
✓ Option 1: Query calendar slots for all qualified employees in one query
✓ Option 2: Use new endpoint: GET /api/v1/person-calendar/available-by-service?service_category=HVAC&limit=1
✓ Option 3: Cache employee availability in Redis with 5-minute TTL
```

**Problem:** Slow service category lookups
**Solution:** Cache settings data aggressively
```
✓ Frontend: Cache settings API responses for 1 hour
✓ Backend: In-memory cache of settings tables, invalidate on updates only
✓ Settings change infrequently, safe to cache
```

**Problem:** Calendar slot generation overhead
**Solution:** Pre-generate slots via scheduled job
```
✓ Daily cron job: Generate next 30 days of slots for all active employees
✓ Slot template: 9 AM - 8 PM, 15-minute increments, Monday-Friday
✓ Auto-mark holidays/PTO as unavailable via employee absence records
```

### 7.3 Error Handling & User Experience

**Problem:** No employees available for urgent request
**Fallback Strategy:**
```
1. Check for employees with ANY availability in next 24 hours
2. Offer alternative service categories (e.g., General Contractor if HVAC specialist unavailable)
3. Add customer to waitlist, notify when slot opens
4. Escalate to manager for manual assignment
```

**Problem:** Customer provides incomplete information
**Conversation Strategy:**
```
✓ Use progressive disclosure: ask one question at a time
✓ Required fields: phone, service type, urgency, location, preferred time
✓ Optional fields: name, email, special instructions (gather later)
✓ Don't process service request until minimum required fields collected
```

**Problem:** AI extracts wrong service category
**Validation & Correction:**
```
✓ Validate extracted service_category against settings API
✓ If no match, ask clarifying question with valid options
✓ Show customer the extracted information for confirmation before booking
✓ Allow customer to correct any field via follow-up messages
```

### 7.4 Security & Privacy

**Problem:** Phone number as identifier exposes PII
**Mitigations:**
```
✓ Hash phone numbers in logs and analytics
✓ Store full phone number only in encrypted database fields
✓ Use JWT tokens for API authentication, not phone numbers
✓ Implement rate limiting on customer lookup endpoint (prevent enumeration attacks)
```

**Problem:** Unauthorized access to customer data
**RBAC Enforcement:**
```
✓ Check entity_rbac for EVERY API call
✓ Customer can only view their own tasks (customer_id match)
✓ Employees can view assigned tasks (assigned_employee_id match)
✓ Managers can view all tasks (entity_id='all' with view permission)
```

**Problem:** Conversation history contains sensitive data
**Data Handling:**
```
✓ Store interactions in f_interaction with encrypted content
✓ Redact credit card numbers, SSNs from transcripts
✓ Set retention policy: delete conversations after 90 days
✓ Comply with GDPR/PIPEDA: allow customers to request deletion
```

### 7.5 AI/LLM Integration Considerations

**Problem:** LLM hallucinations (inventing addresses, times)
**Validation & Grounding:**
```
✓ Validate all extracted data against structured schemas
✓ Confirm address format, postal code validity
✓ Verify time is in future, within business hours
✓ Show extracted information to customer for confirmation
```

**Problem:** Ambiguous service requests
**Clarification Strategy:**
```
✓ If service category unclear, ask: "Is this a plumbing, electrical, or HVAC issue?"
✓ If urgency unclear, ask: "How soon do you need this fixed?"
✓ Provide examples to guide customer responses
✓ Don't guess - always ask for clarification
```

**Problem:** LLM API costs
**Optimization:**
```
✓ Use smaller models for simple extraction tasks (GPT-3.5 vs GPT-4)
✓ Implement caching: don't re-process identical conversations
✓ Use prompt engineering to reduce token usage
✓ Stream responses for better UX without increasing costs
```

### 7.6 Testing & Validation

**Unit Tests:**
```
✓ API client methods: Mock fetch responses, verify request payloads
✓ Orchestrator service: Mock all client methods, test workflow logic
✓ Error handling: Test rollback scenarios (customer creation fails, etc.)
```

**Integration Tests:**
```
✓ Full workflow: Customer lookup → Task creation → Assignment → Booking
✓ Test with real API endpoints (staging environment)
✓ Verify database state after each step
✓ Test rollback scenarios with actual API failures
```

**End-to-End Tests:**
```
✓ Simulate AI chat: Send messages via chat endpoint, verify booking created
✓ Test calendar view: Fetch slots, verify availability updates after booking
✓ Test notifications: Confirm SMS/email sent after booking
```

**Test Script Example:**
```bash
# Use tools/test-api.sh for workflow validation
./tools/test-api.sh GET "/api/v1/cust?phone=+14165551234"
./tools/test-api.sh POST "/api/v1/task" '{"name":"Test HVAC","metadata":{...}}'
./tools/test-api.sh GET "/api/v1/employee?skills_service_categories=HVAC"
./tools/test-api.sh POST "/api/v1/ai-agent/service-request" '{...}'
```

### 7.7 Deployment & Monitoring

**Health Checks:**
```
✓ GET /health → Check database connectivity, Redis, external services
✓ GET /api/v1/datalabel?name=dl__service_category → Verify settings loaded
✓ GET /api/v1/employee?active=true → Confirm employees available
```

**Metrics to Track:**
```
✓ Conversation → Booking conversion rate
✓ Average time to assignment (task creation → employee assigned)
✓ Employee utilization rate (booked slots / total available slots)
✓ Customer satisfaction scores (post-service surveys)
✓ API error rates (4xx, 5xx responses)
```

**Alerting:**
```
✓ Alert if no employees available for >1 hour in emergency category
✓ Alert if API error rate exceeds 5% in 5-minute window
✓ Alert if database connection pool exhausted
✓ Alert if calendar slot generation job fails
```

---

## Appendix: Quick Reference

### Key API Endpoints

| Operation | Method | Endpoint | Purpose |
|-----------|--------|----------|---------|
| Customer Lookup | GET | `/api/v1/cust?phone=+1...` | Find existing customer by phone |
| Create Customer | POST | `/api/v1/cust` | Register new customer |
| Create Task | POST | `/api/v1/task` | Create service request |
| Update Task | PUT | `/api/v1/task/:id` | Link customer, assign employee, link event |
| Find Employees | GET | `/api/v1/employee?skills_service_categories=HVAC` | Match by skills |
| Check Availability | GET | `/api/v1/employee/:id/availability?from=...&to=...` | Verify calendar slots |
| Create Event | POST | `/api/v1/event` | Schedule appointment |
| Book Calendar | POST | `/api/v1/calendar/book` | Reserve time slots |
| Service Request | POST | `/api/v1/ai-agent/service-request` | Complete orchestration |

### Data Model Summary

```
Customer (d_client)
  ├─ phone (PRIMARY IDENTIFIER)
  ├─ name, email, customer_type
  └─ metadata { initial_task_id, conversation_id, created_via }

Task (d_task)
  ├─ code (TASK-12345), name, descr, stage
  └─ metadata {
       customer_id, customer_phone, service_category, urgency_level,
       assigned_employee_id, event_id, conversation_id, service_address
     }

Employee (d_employee)
  ├─ code, name, department, phone, email
  └─ skills_service_categories: ["HVAC", "Plumbing"]

Event (d_event)
  ├─ code (EVT-20251106-789), name, event_entity_action, event_medium, event_addr
  └─ event_metadata { task_id, customer_id, employee_id, service_category }

Calendar Slot (d_entity_person_calendar)
  ├─ person_entity_code, person_entity_id
  ├─ from_ts, to_ts (15-minute increments)
  └─ availability_flag, event_id
```

### Workflow Checklist

```
☐ 1. Extract phone number from conversation (E.164 format)
☐ 2. Lookup customer: GET /api/v1/cust?phone=...
☐ 3. Create task FIRST: POST /api/v1/task (with customer_phone in metadata)
☐ 4. IF new customer: POST /api/v1/cust, then PUT /api/v1/task/:id (link customer_id)
☐ 5. Find employees by skills: GET /api/v1/employee?skills_service_categories=...
☐ 6. Check availability: GET /api/v1/employee/:id/availability?from=...&to=...
☐ 7. Assign employee: PUT /api/v1/task/:id (metadata.assigned_employee_id)
☐ 8. Create event: POST /api/v1/event (with task_id, customer_id, employee_id)
☐ 9. Book calendar: POST /api/v1/calendar/book (employee_id, event_id, time range)
☐ 10. Link event to task: PUT /api/v1/task/:id (metadata.event_id, scheduled_at)
☐ 11. Send confirmations (SMS, email, push notifications)
```

---

**Document Version:** 3.0
**Last Updated:** 2025-11-05
**Maintained By:** PMO Platform Team
**Status:** ✅ Production Ready
**Focus:** API-First Architecture, No Direct SQL
